import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { PeriodError } from '../../../domain/period-error';
import { FakePeriodRepository, provideFakePeriods } from '../../period-repository.fake';
import { PeriodSettingsComponent } from './period-settings.component';

describe('PeriodSettingsComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakePeriodRepository();
    fake.logs = [
      { year: 2026, month: 9, action: 'reopen', automatic: false, reason: 'Faltó un gasto', createdAt: '2026-11-02T15:00:00Z' },
      { year: 2026, month: 10, action: 'close', automatic: true, reason: null, createdAt: '2026-11-05T05:00:00Z' },
      { year: 2025, month: null, action: 'close', automatic: false, reason: null, createdAt: '2026-01-03T15:00:00Z' },
    ];
    await TestBed.configureTestingModule({
      imports: [PeriodSettingsComponent, translocoTesting()],
      providers: [provideFakePeriods(fake)],
    }).compileComponents();
  });

  /** Monta la sección y espera a que `ngModel` lleve el día de cierre al selector. */
  async function render() {
    const fixture = TestBed.createComponent(PeriodSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      element,
      query: (testId: string) => element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`),
      click(testId: string) {
        element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
        fixture.detectChanges();
      },
    };
  }

  function rows(element: HTMLElement): string[] {
    const clean = (node: Element) => node.textContent!.replace(/\s+/g, ' ').trim();

    // Cada fila separa el texto y la fecha con « | »; la fila vacía no tiene columnas.
    return [...element.querySelectorAll('[data-testid="period-history"] li')].map((row) =>
      row.children.length ? [...row.children].map(clean).join(' | ') : clean(row),
    );
  }

  it('shows the stored preferences as switches', async () => {
    const view = await render();

    expect(view.query('period-switch-autoCloseEnabled')?.getAttribute('aria-checked')).toBe('true');
    expect(view.query('period-switch-closeYearWithDecember')?.getAttribute('aria-checked')).toBe('false');
    expect(view.query('period-switch-remindOnMonthEnd')?.getAttribute('aria-checked')).toBe('true');
    expect(view.query('period-close-day')?.textContent).toContain('Day 5 of the following month');
  });

  it('saves a switch at once and reloads the history', async () => {
    const view = await render();

    view.click('period-switch-closeYearWithDecember');

    expect(fake.saved).toEqual([{ autoCloseEnabled: true, autoCloseDay: 5, closeYearWithDecember: true, remindOnMonthEnd: true }]);
    expect(view.query('period-switch-closeYearWithDecember')?.getAttribute('aria-checked')).toBe('true');
    expect(fake.count('history 20')).toBe(2);
  });

  it('saves a new closing day', async () => {
    const view = await render();

    view.element.querySelector<HTMLButtonElement>('[data-testid="period-close-day"] [data-testid="select-trigger"]')!.click();
    view.fixture.detectChanges();
    [...view.element.querySelectorAll<HTMLElement>('[data-testid="period-close-day"] [role="option"]')]
      .find((option) => option.textContent?.includes('Day 10'))!
      .click();
    view.fixture.detectChanges();

    expect(fake.saved).toEqual([expect.objectContaining({ autoCloseDay: 10 })]);
  });

  it('disables the closing day while months do not close on their own', async () => {
    const view = await render();

    view.click('period-switch-autoCloseEnabled');
    await view.fixture.whenStable();
    view.fixture.detectChanges();

    expect(view.query('period-switch-autoCloseEnabled')?.getAttribute('aria-checked')).toBe('false');
    expect(view.element.querySelector<HTMLButtonElement>('[data-testid="period-close-day"] [data-testid="select-trigger"]')?.disabled).toBe(
      true,
    );
  });

  it('goes back to the previous value when saving fails', async () => {
    const view = await render();
    fake.failWith = new PeriodError('Choose one of the available days.');

    view.click('period-switch-remindOnMonthEnd');

    expect(view.query('period-switch-remindOnMonthEnd')?.getAttribute('aria-checked')).toBe('true');
    expect(view.query('period-settings-save-error')?.textContent).toContain('Choose one of the available days.');
    expect(fake.saved).toEqual([]);
  });

  it('describes each closing and reopening in the history', async () => {
    const view = await render();

    expect(rows(view.element)).toEqual([
      'You reopened September 2026 · Faltó un gasto | Nov 2, 2026',
      'October 2026 closed · automatic | Nov 5, 2026',
      'You closed 2025 | Jan 3, 2026',
    ]);
  });

  it('says when there is no history yet', async () => {
    fake.logs = [];

    expect(rows((await render()).element)).toEqual(["You haven't closed any period yet."]);
  });

  it('retries when the preferences cannot be read', async () => {
    fake.failWith = new PeriodError('Server down.');
    const view = await render();

    expect(view.query('period-settings-error')?.textContent).toContain('Server down.');

    view.query('period-settings-error')!.parentElement!.querySelector('button')!.click();
    view.fixture.detectChanges();

    expect(view.query('period-settings-error')).toBeNull();
    expect(view.query('period-switch-autoCloseEnabled')).not.toBeNull();
  });

  it('translates the section into Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const view = await render();

    expect(view.element.textContent).toContain('Cierre de períodos');
    expect(rows(view.element)[0]).toContain('septiembre 2026');
  });
});
