import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { GetCushionCandidatesUseCase, SaveCushionUseCase } from '../../../application/cushion-use-cases';
import { CushionRepository } from '../../../domain/cushion.repository';
import { DashboardError, DashboardErrorCode } from '../../../domain/dashboard-error';
import { FakeCushionRepository, sampleCushion } from '../../cushion-repository.fake';
import { CushionSheetComponent } from './cushion-sheet.component';

async function render(repository = new FakeCushionRepository(), cushion = sampleCushion()) {
  // Otro spec puede dejar el idioma guardado en español.
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [CushionSheetComponent, translocoTesting()],
    providers: [{ provide: CushionRepository, useValue: repository }, GetCushionCandidatesUseCase, SaveCushionUseCase],
  });
  const fixture = TestBed.createComponent(CushionSheetComponent);
  fixture.componentRef.setInput('cushion', cushion);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  const query = <T extends HTMLElement>(testId: string) => element.querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => query(testId)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const click = (testId: string) => {
    query<HTMLButtonElement>(testId)!.click();
    fixture.detectChanges();
  };

  return { fixture, element, query, text, click, repository, component: fixture.componentInstance };
}

describe('CushionSheetComponent', () => {
  it('lists the accounts with the marked ones checked and a live summary', async () => {
    const { element, text } = await render();

    const rows = [...element.querySelectorAll<HTMLButtonElement>('[data-testid="cushion-candidate"]')];
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'true', 'false']);
    expect(rows[0].getAttribute('role')).toBe('checkbox');
    expect(rows[0].textContent).toContain('Account · COP');
    expect(text('cushion-goal')).toBe('6 months');
    expect(text('cushion-preview')).toContain('COP 9,360,000 covers 2.4 months.');
    expect(text('cushion-preview')).toContain('6 months goal ≈ COP 23,400,000 · COP 14,040,000 to go');
  });

  it('says it is the first time when no account is marked', async () => {
    const { element } = await render(new FakeCushionRepository(), sampleCushion({ hasCushionAccounts: false, currencies: [] }));

    expect(element.querySelector('#cushion-sheet-title')!.textContent).toContain('Choose your cushion');
  });

  it('updates the summary when toggling accounts', async () => {
    const { element, text, fixture } = await render();
    const rows = element.querySelectorAll<HTMLButtonElement>('[data-testid="cushion-candidate"]');

    rows[2].click();
    fixture.detectChanges();
    expect(rows[2].getAttribute('aria-checked')).toBe('true');
    expect(text('cushion-preview')).toContain("There is no spending in dollars to compare it with yet.");

    rows[0].click();
    rows[1].click();
    rows[2].click();
    fixture.detectChanges();
    expect(text('cushion-preview')).toContain('With no accounts marked');
  });

  it('keeps the goal between 1 and 24', async () => {
    const { query, text, click } = await render(new FakeCushionRepository(), sampleCushion({ goalMonths: 2 }));

    click('cushion-goal-decrease');
    expect(text('cushion-goal')).toBe('1 month');
    expect(query<HTMLButtonElement>('cushion-goal-decrease')!.disabled).toBe(true);

    for (let i = 0; i < 30; i++) {
      click('cushion-goal-increase');
    }
    expect(text('cushion-goal')).toBe('24 months');
    expect(query<HTMLButtonElement>('cushion-goal-increase')!.disabled).toBe(true);
  });

  it('saves the accounts and then the goal', async () => {
    const { element, fixture, click, repository, component } = await render();
    let saved = 0;
    component.saved.subscribe(() => saved++);

    element.querySelectorAll<HTMLButtonElement>('[data-testid="cushion-candidate"]')[1].click();
    fixture.detectChanges();
    click('cushion-goal-increase');
    click('cushion-sheet-save');

    expect(repository.savedAccounts).toEqual([[1]]);
    expect(repository.savedGoals).toEqual([7]);
    expect(saved).toBe(1);
  });

  it('shows the error and stays open when saving fails', async () => {
    const repository = new FakeCushionRepository();
    repository.saveAccountsError = new DashboardError('Una tarjeta de crédito no puede ser parte del colchón.', DashboardErrorCode.CushionCreditCard);
    const { text, click, component } = await render(repository);
    let saved = 0;
    component.saved.subscribe(() => saved++);

    click('cushion-sheet-save');

    expect(text('cushion-sheet-error')).toBe('Una tarjeta de crédito no puede ser parte del colchón.');
    expect(repository.savedGoals).toEqual([]);
    expect(saved).toBe(0);
  });

  it('closes without saving', async () => {
    const { click, repository, component } = await render();
    let closed = 0;
    component.closed.subscribe(() => closed++);

    click('cushion-sheet-cancel');
    click('cushion-sheet-close');

    expect(closed).toBe(2);
    expect(repository.savedAccounts).toEqual([]);
  });

  it('explains when there are no accounts to choose', async () => {
    const repository = new FakeCushionRepository();
    repository.candidateList = [];
    const { text } = await render(repository);

    expect(text('cushion-sheet-no-accounts')).toContain("You don't have any accounts that can be part of the cushion yet.");
  });
});
