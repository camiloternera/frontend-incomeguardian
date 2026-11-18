import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { Cushion } from '../../../domain/cushion';
import { cushionCurrency, sampleCushion } from '../../cushion-repository.fake';
import { CushionCardComponent, CushionLoad } from './cushion-card.component';

function render(load: CushionLoad, amountsHidden = false) {
  // Otro spec puede dejar el idioma guardado en español.
  localStorage.clear();
  TestBed.configureTestingModule({ imports: [CushionCardComponent, translocoTesting()] });
  const fixture = TestBed.createComponent(CushionCardComponent);
  fixture.componentRef.setInput('load', load);
  fixture.componentRef.setInput('amountsHidden', amountsHidden);
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  const text = (testId: string) =>
    [...element.querySelectorAll(`[data-testid="${testId}"]`)].map((node) => node.textContent!.replace(/\s+/g, ' ').trim()).join(' | ');

  return { fixture, element, text, component: fixture.componentInstance };
}

const ready = (cushion: Cushion): CushionLoad => ({ status: 'ready', cushion });

describe('CushionCardComponent', () => {
  it('asks to choose accounts when none is marked, never "0 months"', () => {
    const { element, text, component } = render(ready(sampleCushion({ hasCushionAccounts: false, currencies: [] })));
    let opened = 0;
    component.configure.subscribe(() => opened++);

    expect(text('cushion-empty')).toContain('Choose where you keep your emergency savings');
    expect(text('cushion-empty')).toContain('The goal starts at 6 months');
    expect(element.textContent).not.toContain('0.0 months');
    expect(element.querySelector('[data-testid="cushion-adjust"]')).toBeNull();

    element.querySelector<HTMLButtonElement>('[data-testid="cushion-choose"]')!.click();
    expect(opened).toBe(1);
  });

  it('shows the months, the goal bar and what is missing', () => {
    const { element, text, component } = render(ready(sampleCushion()));
    let opened = 0;
    component.configure.subscribe(() => opened++);

    expect(text('cushion-hero')).toBe('2.4 months');
    expect(text('cushion-body')).toContain('Your savings (COP 9,360,000) cover 2.4 months at your average pace over the last 5 months (COP 3,900,000 a month).');
    expect(text('cushion-foot')).toBe('COP 14,040,000 to go to reach the goal');
    expect(text('cushion-footer')).toBe('Goal: 6 months · Davivienda ahorros, Bolsillo Nu');
    const meter = element.querySelector('[data-testid="cushion-meter"]')!;
    expect(meter.getAttribute('role')).toBe('img');
    expect(meter.getAttribute('aria-label')).toBe('2.4 of a 6-month goal');
    expect(meter.querySelectorAll(':scope > span').length).toBe(6);
    // 2,4 de 6 meses: dos segmentos llenos y el tercero al 40 %.
    const fills = [...meter.querySelectorAll<HTMLElement>(':scope > span > span')].map((span) => span.style.width);
    expect(fills.slice(0, 4)).toEqual(['100%', '100%', '40%', '0%']);

    element.querySelector<HTMLButtonElement>('[data-testid="cushion-adjust"]')!.click();
    expect(opened).toBe(1);
  });

  it('says "the last month" when only one month was averaged', () => {
    const { text } = render(ready(sampleCushion({ currencies: [cushionCurrency({ monthsUsed: 1 })] })));

    expect(text('cushion-body')).toContain('over the last month');
  });

  it('shows a real "0 months" when the marked accounts are empty', () => {
    const { element, text } = render(
      ready(sampleCushion({ currencies: [cushionCurrency({ savings: 0, monthsCovered: 0, missing: 23_400_000 })] })),
    );

    expect(element.querySelector('[data-testid="cushion-row"]')!.getAttribute('data-state')).toBe('zero');
    expect(text('cushion-hero')).toBe('0.0 months');
    expect(text('cushion-body')).toContain('Your cushion accounts are at COP 0');
  });

  it('shows the saved amount without a bar before the first full month', () => {
    const { element, text } = render(
      ready(sampleCushion({ currencies: [cushionCurrency({ savings: 8_000_000, monthsUsed: 0, monthsCovered: null, reason: 'noPreviousMonths', goalAmount: null, missing: null })] })),
    );

    expect(text('cushion-hero')).toBe('COP 8,000,000');
    expect(text('cushion-body')).toContain('Once you close your first full month');
    expect(element.querySelector('[data-testid="cushion-meter"]')).toBeNull();
  });

  it('explains when there is no spending to compare with', () => {
    const { element, text } = render(
      ready(sampleCushion({ currencies: [cushionCurrency({ monthsCovered: null, reason: 'noSpending', goalAmount: null, missing: null, averageMonthlySpent: 0 })] })),
    );

    expect(text('cushion-body')).toContain('There is no spending in pesos over the last 5 months');
    expect(element.querySelector('[data-testid="cushion-meter"]')).toBeNull();
  });

  it('celebrates the goal, shows the surplus and offers to raise it', () => {
    const { element, text, component } = render(
      ready(sampleCushion({ currencies: [cushionCurrency({ savings: 26_520_000, monthsCovered: 6.8, missing: 0 })] })),
    );
    let opened = 0;
    component.configure.subscribe(() => opened++);

    expect(text('cushion-reached')).toBe('Goal reached');
    expect(text('cushion-foot')).toContain('You exceed the goal by COP 3,120,000');
    element.querySelector<HTMLButtonElement>('[data-testid="cushion-raise"]')!.click();
    expect(opened).toBe(1);
  });

  it('shows one row per currency, pesos first, without adding them up', () => {
    const { element, text } = render(
      ready(
        sampleCushion({
          currencies: [
            cushionCurrency(),
            cushionCurrency({ currency: 'USD', savings: 1_200, averageMonthlySpent: 150, monthsCovered: 8, goalAmount: 900, missing: 0, accounts: [{ id: 3, name: 'Cuenta USD', balance: 1_200 }] }),
          ],
        }),
      ),
    );

    const rows = element.querySelectorAll('[data-testid="cushion-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('PESOS · COP');
    expect(rows[1].textContent).toContain('DOLLARS · USD');
    expect(rows[1].getAttribute('data-state')).toBe('goalReached');
    expect(text('cushion-footer')).toContain('Davivienda ahorros, Bolsillo Nu, Cuenta USD');
  });

  it('masks only the money when amounts are hidden', () => {
    const { text } = render(ready(sampleCushion()), true);

    expect(text('cushion-hero')).toBe('2.4 months');
    expect(text('cushion-body')).not.toContain('9,360,000');
    expect(text('cushion-body')).toContain('•••••');
    expect(text('cushion-foot')).toBe('••••• to go to reach the goal');
  });

  it('shows the loading state and retries after an error', () => {
    const loading = render({ status: 'loading' });
    expect(loading.element.querySelector('[data-testid="cushion-loading"]')?.getAttribute('role')).toBe('status');

    TestBed.resetTestingModule();
    const { element, text, component } = render({ status: 'error', message: 'Algo falló' });
    let retried = 0;
    component.retry.subscribe(() => retried++);

    expect(text('cushion-error')).toContain('Algo falló');
    element.querySelector<HTMLButtonElement>('[data-testid="cushion-retry"]')!.click();
    expect(retried).toBe(1);
  });
});
