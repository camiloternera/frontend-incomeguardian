import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { BudgetMonth, formatMonthKey, monthOfDay, shiftMonth, todayInBudgetZone } from '../../../domain/budget';
import { BudgetError, BudgetErrorCode } from '../../../domain/budget-error';
import { BudgetFakes, fakeBudgetsRoutes, sampleSummary } from '../../budget-repository.fake';

const CURRENT: BudgetMonth = monthOfDay(todayInBudgetZone());
const PREVIOUS = shiftMonth(CURRENT, -1);
const NEXT = shiftMonth(CURRENT, 1);

describe('BudgetPanelComponent', () => {
  let fakes: BudgetFakes;

  beforeEach(async () => {
    localStorage.clear();
    fakes = new BudgetFakes();
    fakes.budgets.summaries[formatMonthKey(CURRENT)] = sampleSummary(CURRENT);
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeBudgetsRoutes(fakes))],
    }).compileComponents();
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);
    await settle(harness);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  async function settle(harness: RouterTestingHarness): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function query<E extends HTMLElement = HTMLElement>(element: HTMLElement, testId: string): E | null {
    return element.querySelector<E>(`[data-testid="${testId}"]`);
  }

  function text(element: HTMLElement, testId: string): string {
    return query(element, testId)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function type(element: HTMLElement, value: string): void {
    const field = query<HTMLInputElement>(element, 'budget-amount')!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
  }

  function chooseScope(element: HTMLElement, scope: 'recurring' | 'month'): void {
    element.querySelector<HTMLInputElement>(`[data-testid="scope-${scope}"] input`)!.click();
  }

  function submit(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  function optionLabels(element: HTMLElement, harness: RouterTestingHarness): string[] {
    const trigger = element.querySelector<HTMLButtonElement>('[data-testid="budget-category"] [data-testid="select-trigger"]')!;
    trigger.click();
    harness.detectChanges();
    const labels = [...element.querySelectorAll('[data-testid="budget-category"] [role="option"]')].map(
      (option) => option.textContent!.trim(),
    );
    trigger.click();
    harness.detectChanges();

    return labels;
  }

  function choose(element: HTMLElement, label: string, harness: RouterTestingHarness): void {
    element.querySelector<HTMLButtonElement>('[data-testid="budget-category"] [data-testid="select-trigger"]')!.click();
    harness.detectChanges();
    [...element.querySelectorAll<HTMLElement>('[data-testid="budget-category"] [role="option"]')]
      .find((option) => option.textContent?.includes(label))!
      .click();
    harness.detectChanges();
  }

  it('edits a recurring limit from this month on and returns to the budget with a notice', async () => {
    const { harness, element } = await open('/budgets/4/COP');

    expect(query(element, 'budget-list-page')).toBeTruthy();
    expect(text(element, 'panel-subtitle')).toBe('Expense · COP');
    expect(query<HTMLInputElement>(element, 'budget-amount')!.value).toBe('1,800,000');
    expect(query<HTMLInputElement>(element, 'scope-recurring')!.querySelector('input')!.checked).toBe(true);
    expect(text(element, 'spent-note')).toContain('1,800,000');

    type(element, '2,000,000');
    submit(element);
    await settle(harness);

    expect(fakes.budgets.calls).toEqual([
      { action: 'saveRecurring', args: [{ categoryId: 4, currency: 'COP' }, 2000000, CURRENT] },
    ]);
    expect(TestBed.inject(Router).url).toBe('/budgets');
    expect(text(element, 'budget-notice')).toContain('You saved the limit for Vivienda.');
    // El resumen se vuelve a pedir para reflejar el cambio.
    expect(fakes.budgets.requested).toHaveLength(2);
  });

  it('pauses a category for this month only with a limit of 0', async () => {
    const { harness, element } = await open('/budgets/4/COP');

    type(element, '0');
    harness.detectChanges();
    // Un tope recurrente de 0 no existe.
    expect(text(element, 'amount-error')).toContain('must be greater than zero');

    chooseScope(element, 'month');
    harness.detectChanges();
    expect(query(element, 'amount-error')).toBeNull();

    submit(element);
    await settle(harness);

    expect(fakes.budgets.calls).toEqual([{ action: 'saveMonth', args: [CURRENT, { categoryId: 4, currency: 'COP' }, 0] }]);
  });

  it('brings a month with its own limit back to the recurring one', async () => {
    const { harness, element } = await open('/budgets/1/COP');

    expect(query<HTMLInputElement>(element, 'scope-month')!.querySelector('input')!.checked).toBe(true);
    expect(text(element, 'budget-override')).toContain('800,000');

    query(element, 'budget-reset')!.click();
    await settle(harness);

    expect(fakes.budgets.calls).toEqual([{ action: 'removeMonth', args: [CURRENT, { categoryId: 1, currency: 'COP' }] }]);
    expect(text(element, 'budget-notice')).toContain('Alimentación is back on its recurring limit.');
  });

  it('removes a limit from this month on', async () => {
    const { harness, element } = await open('/budgets/3/COP');

    query(element, 'budget-remove')!.click();
    await settle(harness);

    expect(fakes.budgets.calls).toEqual([
      { action: 'removeRecurring', args: [{ categoryId: 3, currency: 'COP' }, CURRENT] },
    ]);
  });

  it('adds a limit for an expense or transfer category without one in that currency', async () => {
    const { harness, element } = await open('/budgets/new');

    expect(text(element, 'panel-subtitle')).toContain('Applies from');
    // Sin ingresos, sin desactivadas y sin las que ya tienen tope en pesos.
    expect(optionLabels(element, harness)).toEqual([
      'Ahorro para viaje · Transfer',
      'Salud · Expense',
      'Software · Expense',
      'Transporte · Expense',
    ]);

    query(element, 'budget-currency-USD')!.click();
    harness.detectChanges();
    expect(optionLabels(element, harness)).not.toContain('Software · Expense');
    query(element, 'budget-currency-COP')!.click();
    harness.detectChanges();

    type(element, '300000');
    submit(element);
    await settle(harness);
    expect(text(element, 'category-error')).toBe('Pick a category.');
    expect(fakes.budgets.calls).toEqual([]);

    choose(element, 'Transporte', harness);
    submit(element);
    await settle(harness);

    expect(fakes.budgets.calls).toEqual([
      { action: 'saveRecurring', args: [{ categoryId: 2, currency: 'COP' }, 300000, CURRENT] },
    ]);
  });

  it('proposes the currency the budget is showing when adding a limit', async () => {
    const { element } = await open('/budgets/new?currency=USD');

    expect(query(element, 'budget-currency-USD')!.getAttribute('aria-checked')).toBe('true');
    expect(query(element, 'budget-currency-COP')!.getAttribute('aria-checked')).toBe('false');
  });

  it('closes the panel and keeps the visible currency', async () => {
    const { harness, element } = await open('/budgets/8/USD?currency=USD');

    query(element, 'budget-panel-close')!.click();
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/budgets?currency=USD');
    expect(query(element, 'block-USD')).toBeTruthy();
  });

  it('shows the backend amount error next to the amount', async () => {
    const { harness, element } = await open('/budgets/4/COP');
    fakes.budgets.writeFailWith = new BudgetError('Invalid', BudgetErrorCode.AmountInvalid);

    type(element, '10');
    submit(element);
    await settle(harness);

    expect(text(element, 'amount-error')).toContain('greater than or equal to zero');
    expect(TestBed.inject(Router).url).toBe('/budgets/4/COP');
  });

  it('is read-only in a closed month', async () => {
    fakes.budgets.summaries[formatMonthKey(PREVIOUS)] = { ...sampleSummary(PREVIOUS), isClosed: true };
    const { element } = await open(`/budgets/4/COP?month=${formatMonthKey(PREVIOUS)}`);

    expect(text(element, 'budget-read-only')).toContain('This month is closed');
    expect(element.querySelector('form')).toBeNull();
  });

  it('says so when the category is not in the month', async () => {
    const { element } = await open('/budgets/99/COP');

    expect(query(element, 'budget-not-found')).toBeTruthy();
  });
  it('shows what counts this month below the form', async () => {
    fakes.movements.movements = [
      { transactionId: 7, description: 'Mercado', accountName: 'Bancolombia', date: '2026-11-03T15:00:00Z', amount: 30000 },
    ];
    const { element } = await open('/budgets/1/COP');

    expect(query(element, 'budget-month-detail')).toBeTruthy();
    expect(fakes.movements.requested).toEqual([{ month: CURRENT, key: { categoryId: 1, currency: 'COP' }, type: 'expense' }]);
    expect(text(element, 'budget-spent-lines')).toContain('Mercado');
  });

  it('does not show the month detail while adding a new limit', async () => {
    const { element } = await open('/budgets/new');

    expect(query(element, 'budget-month-detail')).toBeNull();
  });
  it('is view-only in a future month and still shows what counts in it', async () => {
    fakes.budgets.summaries[formatMonthKey(NEXT)] = sampleSummary(NEXT);
    const { element } = await open(`/budgets/1/COP?month=${formatMonthKey(NEXT)}`);

    expect(text(element, 'budget-read-only')).toContain("This month hasn't started yet");
    expect(element.querySelector('form')).toBeNull();
    expect(query(element, 'budget-month-detail')).toBeTruthy();
    expect(fakes.movements.requested).toEqual([{ month: NEXT, key: { categoryId: 1, currency: 'COP' }, type: 'expense' }]);
  });

  it('is view-only when adding a limit in a future month', async () => {
    const { element } = await open(`/budgets/new?month=${formatMonthKey(NEXT)}`);

    expect(text(element, 'budget-read-only')).toContain("This month hasn't started yet");
    expect(element.querySelector('form')).toBeNull();
  });

  it('says so when the category is not in a future month', async () => {
    fakes.budgets.summaries[formatMonthKey(NEXT)] = sampleSummary(NEXT);
    const { element } = await open(`/budgets/99/COP?month=${formatMonthKey(NEXT)}`);

    expect(query(element, 'budget-not-found')).toBeTruthy();
    expect(query(element, 'budget-read-only')).toBeNull();
  });

  it('keeps a closed future month as closed', async () => {
    fakes.budgets.summaries[formatMonthKey(NEXT)] = { ...sampleSummary(NEXT), isClosed: true };
    const { element } = await open(`/budgets/1/COP?month=${formatMonthKey(NEXT)}`);

    expect(text(element, 'budget-read-only')).toContain('This month is closed');
  });
});
