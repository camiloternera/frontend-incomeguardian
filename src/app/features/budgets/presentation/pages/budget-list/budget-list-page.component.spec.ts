import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import {
  BUDGET_FUTURE_MONTHS_MAX,
  BudgetMonth,
  BudgetRow,
  BudgetTotal,
  daysLeftInMonth,
  formatMonthKey,
  lastViewableMonth,
  monthOfDay,
  shiftMonth,
  todayInBudgetZone,
} from '../../../domain/budget';
import { BudgetError } from '../../../domain/budget-error';
import { BudgetFakes, fakeBudgetsRoutes, sampleSummary } from '../../budget-repository.fake';

/** El mes en curso depende del reloj real. */
const TODAY = todayInBudgetZone();
const CURRENT: BudgetMonth = monthOfDay(TODAY);
const PREVIOUS = shiftMonth(CURRENT, -1);
const NEXT = shiftMonth(CURRENT, 1);
const LAST = lastViewableMonth(CURRENT);

describe('BudgetListPageComponent', () => {
  let fakes: BudgetFakes;

  async function open(url = '/budgets') {
    const harness = await RouterTestingHarness.create(url);
    await settle(harness);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  async function settle(harness: RouterTestingHarness): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function query(element: HTMLElement, selector: string): HTMLElement | null {
    return element.querySelector<HTMLElement>(selector);
  }

  function text(element: HTMLElement | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function row(element: HTMLElement, key: string): HTMLElement {
    return query(element, `[data-testid="budget-row-${key}"]`)!;
  }

  beforeEach(async () => {
    localStorage.clear();
    fakes = new BudgetFakes();
    fakes.budgets.summaries[formatMonthKey(CURRENT)] = sampleSummary(CURRENT);
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeBudgetsRoutes(fakes))],
    }).compileComponents();
  });

  /** Abre el filtro de moneda y devuelve sus opciones. */
  function currencyOptions(element: HTMLElement, harness: RouterTestingHarness): HTMLElement[] {
    query(element, '[data-testid="currency-filter"] [data-testid="select-trigger"]')!.click();
    harness.detectChanges();

    return [...element.querySelectorAll<HTMLElement>('[data-testid="currency-filter"] [role="option"]')];
  }

  /** Elige una moneda en el filtro por su código. */
  async function chooseCurrency(element: HTMLElement, harness: RouterTestingHarness, code: string): Promise<void> {
    currencyOptions(element, harness)
      .find((option) => option.textContent?.includes(code))!
      .click();
    await settle(harness);
  }

  it('shows the block of one currency with its totals and the usage of each category', async () => {
    const { element } = await open();

    expect(fakes.budgets.requested).toEqual([CURRENT]);
    expect(query(element, '[data-testid="block-COP"]')).toBeTruthy();
    expect(query(element, '[data-testid="block-USD"]')).toBeNull();
    expect(query(element, '[data-testid="block-title"]')).toBeNull();
    expect(text(query(element, '[data-testid="block-COP"] [data-testid="block-percent"]'))).toContain('71 %');
    expect(text(query(element, '[data-testid="block-COP"] [data-testid="block-available"]'))).toContain('821,900');

    const notes = (key: string) => text(row(element, key).querySelector('[data-testid="row-note"]'));
    expect(notes('1-COP')).toBe('4 % used');
    expect(notes('3-COP')).toMatch(/^Over by .*14,900$/);
    expect(notes('4-COP')).toBe('Limit reached');
    expect(notes('5-COP')).toMatch(/^No limit: you spent .*38,200$/);
    expect(notes('6-COP')).toBe('Paused this month');

    const source = (key: string) => text(row(element, key).querySelector('[data-testid="row-source"]'));
    expect(source('1-COP')).toBe('This month only');
    expect(source('4-COP')).toBe('Every month');
    expect(source('5-COP')).toBe('No limit');
    expect(source('6-COP')).toBe('Paused this month only');

    expect(text(query(element, '[data-testid="budget-footnote"]'))).toContain('Income has no limit.');
  });

  it('switches the visible currency through ?currency= with the filter', async () => {
    const { harness, element } = await open();
    const router = TestBed.inject(Router);

    expect(query(element, 'label[for="budget-currency"]')?.textContent?.trim()).toBe('Currency');
    expect(currencyOptions(element, harness).map((option) => text(option))).toEqual([
      'Colombian pesos · COP',
      'US dollars · USD',
    ]);
    query(element, '[data-testid="currency-filter"] [data-testid="select-trigger"]')!.click();
    harness.detectChanges();

    await chooseCurrency(element, harness, 'USD');

    expect(router.url).toBe('/budgets?currency=USD');
    expect(query(element, '[data-testid="block-USD"]')).toBeTruthy();
    expect(query(element, '[data-testid="block-COP"]')).toBeNull();
    expect(row(element, '8-USD')).toBeTruthy();
    // Cambiar de moneda no vuelve a pedir el resumen.
    expect(fakes.budgets.requested).toHaveLength(1);

    await chooseCurrency(element, harness, 'COP');

    expect(router.url).toBe('/budgets');
    expect(query(element, '[data-testid="block-COP"]')).toBeTruthy();
    expect(query(element, '[data-testid="block-USD"]')).toBeNull();
  });

  it('keeps an open panel when switching the currency', async () => {
    const { harness, element } = await open('/budgets/new');

    await chooseCurrency(element, harness, 'USD');

    expect(TestBed.inject(Router).url).toBe('/budgets/new?currency=USD');
    expect(query(element, '[data-testid="block-USD"]')).toBeTruthy();
  });

  it('opens the currency from the URL', async () => {
    const { element } = await open('/budgets?currency=USD');

    expect(query(element, '[data-testid="block-USD"]')).toBeTruthy();
    expect(query(element, '[data-testid="block-COP"]')).toBeNull();
    expect(text(query(element, '[data-testid="block-USD"] [data-testid="block-available"]'))).toContain('16');
  });

  it('falls back to pesos when the month has no rows in the requested currency', async () => {
    const { element } = await open('/budgets?currency=EUR');

    expect(query(element, '[data-testid="block-COP"]')).toBeTruthy();
    expect(query(element, '[data-testid="block-EUR"]')).toBeNull();
  });

  it('shows the currency name instead of the filter when the month has a single currency', async () => {
    const summary = sampleSummary(CURRENT);
    fakes.budgets.summaries[formatMonthKey(CURRENT)] = {
      ...summary,
      rows: summary.rows.filter((budget) => budget.currency === 'COP'),
      totals: summary.totals.filter((total) => total.currency === 'COP'),
    };
    const { element } = await open('/budgets?currency=USD');

    expect(query(element, '[data-testid="currency-filter"]')).toBeNull();
    expect(query(element, '[data-testid="block-COP"]')).toBeTruthy();
    expect(text(query(element, '[data-testid="block-title"]'))).toBe('Colombian pesos COP');
  });

  it('carries the currency into the panel links and across months', async () => {
    const { harness, element } = await open('/budgets?currency=USD');

    expect(query(element, '[data-testid="new-budget"]')?.getAttribute('href')).toBe('/budgets/new?currency=USD');
    expect(row(element, '8-USD').querySelector('[data-testid="row-edit"]')?.getAttribute('href')).toBe(
      '/budgets/8/USD?currency=USD',
    );

    query(element, '[data-testid="month-previous"]')!.click();
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe(`/budgets?month=${formatMonthKey(PREVIOUS)}&currency=USD`);
    expect(query(element, '[data-testid="new-first-budget"]')?.getAttribute('href')).toBe(
      `/budgets/new?month=${formatMonthKey(PREVIOUS)}&currency=USD`,
    );
  });

  it('opens a row in the side panel and keeps deactivated categories read-only', async () => {
    const { element } = await open();

    expect(row(element, '4-COP').querySelector('[data-testid="row-edit"]')?.getAttribute('href')).toBe('/budgets/4/COP');
    // «Salidas al cine» está desactivada: se ve, pero no se edita.
    const inactive = row(element, '7-COP');
    expect(inactive.querySelector('[data-testid="row-edit"]')).toBeNull();
    expect(text(inactive.querySelector('[data-testid="row-kind"]'))).toBe('Expense · deactivated category');
  });

  it('counts the days left in the current month and lets you look at the next one', async () => {
    const { element } = await open();
    const days = daysLeftInMonth(TODAY);

    expect(query(element, '[data-testid="month-next"]')?.hasAttribute('disabled')).toBe(false);
    if (days > 1) {
      expect(text(query(element, '[data-testid="time-note"]'))).toBe(`${days} days left this month`);
    }
    expect(query(element, '[data-testid="new-budget"]')?.getAttribute('href')).toBe('/budgets/new');
  });

  it('steps back a month through ?month= and shows the empty state', async () => {
    const { harness, element } = await open();

    query(element, '[data-testid="month-previous"]')!.click();
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe(`/budgets?month=${formatMonthKey(PREVIOUS)}`);
    expect(fakes.budgets.requested.at(-1)).toEqual(PREVIOUS);
    expect(text(query(element, '[data-testid="budget-empty"]'))).toContain('You have no limits yet');
    expect(query(element, '[data-testid="new-first-budget"]')?.getAttribute('href')).toBe(
      `/budgets/new?month=${formatMonthKey(PREVIOUS)}`,
    );
  });

  it('makes a closed month read-only and offers to reopen it', async () => {
    fakes.budgets.summaries[formatMonthKey(PREVIOUS)] = { ...sampleSummary(PREVIOUS), isClosed: true };
    const { element } = await open(`/budgets?month=${formatMonthKey(PREVIOUS)}`);

    expect(text(query(element, '[data-testid="closed-notice"]'))).toContain('This month is closed');
    expect(query(element, '[data-testid="reopen-period"]')).toBeTruthy();
    expect(query(element, '[data-testid="new-budget"]')).toBeNull();
    expect(query(element, '[data-testid="row-edit"]')).toBeNull();
    expect(query(element, '[data-testid="time-note"]')).toBeNull();
  });

  it('offers a retry when the summary fails to load', async () => {
    fakes.budgets.failWith = new BudgetError('The service is down.');
    const { harness, element } = await open();

    expect(text(query(element, '[data-testid="load-error"]'))).toBe('The service is down.');

    query(element, '[data-testid="retry"]')!.click();
    await settle(harness);

    expect(query(element, '[data-testid="block-COP"]')).toBeTruthy();
  });
  describe('installments', () => {
    function purchase(transactionId: number, installments: number) {
      return {
        transactionId,
        description: 'Compra',
        number: 1,
        installments,
        accountId: 9,
        accountName: 'Visa',
        purchaseDate: '2026-11-03',
        amount: 10000,
        budgetAdjustment: 0,
      };
    }

    function withRow(overrides: Partial<BudgetRow>, totals: Partial<BudgetTotal> = {}): void {
      const summary = sampleSummary(CURRENT);
      summary.rows = summary.rows.map((item) => (item.categoryId === 1 && item.currency === 'COP' ? { ...item, ...overrides } : item));
      summary.totals = summary.totals.map((total) => (total.currency === 'COP' ? { ...total, ...totals } : total));
      fakes.budgets.summaries[formatMonthKey(CURRENT)] = summary;
    }

    it('counts only the purchases of more than one installment in the chip', async () => {
      withRow({ installments: [purchase(1, 1), purchase(2, 3), purchase(3, 12)] });
      const { element } = await open();

      expect(text(row(element, '1-COP').querySelector('[data-testid="row-installments"]'))).toBe('2 in installments');
    });

    it('does not show the chip with only single-installment purchases', async () => {
      withRow({ installments: [purchase(1, 1)] });
      const { element } = await open();

      expect(row(element, '1-COP').querySelector('[data-testid="row-installments"]')).toBeNull();
    });

    it('says when installments raised the limit of the month', async () => {
      withRow({ installmentsRaise: 50000 });
      const { element } = await open();

      expect(text(row(element, '1-COP').querySelector('[data-testid="row-source"]'))).toContain('raised by installments');
      expect(text(row(element, '3-COP').querySelector('[data-testid="row-source"]'))).not.toContain('raised by installments');
    });

    it('shows how much of the spending went to installment purchases', async () => {
      withRow({}, { installmentsSpent: 120000 });
      const { element } = await open();
      const note = text(query(element, '[data-testid="block-COP"] [data-testid="block-installments"]'));

      expect(note).toContain('Of that, on installment purchases');
      expect(note).toContain('120,000');
    });

    it('hides that line when no installment purchase counts', async () => {
      const { element } = await open();

      expect(query(element, '[data-testid="block-COP"] [data-testid="block-installments"]')).toBeNull();
    });
  });
  describe('future months', () => {
    it('steps forward to the next month in view-only mode', async () => {
      fakes.budgets.summaries[formatMonthKey(NEXT)] = sampleSummary(NEXT);
      const { harness, element } = await open();

      query(element, '[data-testid="month-next"]')!.click();
      await settle(harness);

      expect(TestBed.inject(Router).url).toBe(`/budgets?month=${formatMonthKey(NEXT)}`);
      expect(fakes.budgets.requested.at(-1)).toEqual(NEXT);
      expect(text(query(element, '[data-testid="time-note"]'))).toBe('Future month: view only');
      expect(query(element, '[data-testid="new-budget"]')).toBeNull();
    });

    it('keeps the rows linked to a view-only panel', async () => {
      fakes.budgets.summaries[formatMonthKey(NEXT)] = sampleSummary(NEXT);
      const { element } = await open(`/budgets?month=${formatMonthKey(NEXT)}`);
      const link = row(element, '4-COP').querySelector('[data-testid="row-edit"]')!;

      expect(link.getAttribute('href')).toBe(`/budgets/4/COP?month=${formatMonthKey(NEXT)}`);
      expect(link.getAttribute('aria-label')).toMatch(/^View the .* limit$/);
    });

    it('labels the rows as editable in the current month', async () => {
      const { element } = await open();

      expect(row(element, '4-COP').querySelector('[data-testid="row-edit"]')?.getAttribute('aria-label')).not.toMatch(/^View the/);
    });

    it('explains an empty future month without offering to add a limit', async () => {
      const { element } = await open(`/budgets?month=${formatMonthKey(NEXT)}`);
      const empty = text(query(element, '[data-testid="budget-empty"]'));

      expect(empty).toContain('No limits or installments in');
      expect(empty).toContain('Future months are view only.');
      expect(query(element, '[data-testid="new-first-budget"]')).toBeNull();
    });

    it(`opens up to ${BUDGET_FUTURE_MONTHS_MAX} months ahead and blocks the next one there`, async () => {
      const { element } = await open(`/budgets?month=${formatMonthKey(LAST)}`);

      expect(fakes.budgets.requested).toEqual([LAST]);
      expect(query(element, '[data-testid="month-next"]')?.hasAttribute('disabled')).toBe(true);
      expect(query(element, '[data-testid="month-previous"]')?.hasAttribute('disabled')).toBe(false);
    });

    it('falls back to the current month beyond the last viewable one', async () => {
      await open(`/budgets?month=${formatMonthKey(shiftMonth(LAST, 1))}`);

      expect(fakes.budgets.requested).toEqual([CURRENT]);
    });

    it('translates the future month into Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open(`/budgets?month=${formatMonthKey(NEXT)}`);

      expect(text(query(element, '[data-testid="time-note"]'))).toBe('Mes futuro: solo consulta');
      expect(text(query(element, '[data-testid="budget-empty"]'))).toContain('Los meses futuros son de solo consulta.');
    });
  });
});
