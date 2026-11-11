import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { periodYear } from '@features/periods/testing';
import { TransactionError, TransactionErrorCode } from '../../../domain/transaction-error';
import { TransactionFakes, fakeTransactionsRoutes } from '../../transaction-repository.fake';

describe('TransactionPanelComponent', () => {
  let fakes: TransactionFakes;

  beforeEach(async () => {
    localStorage.clear();
    fakes = new TransactionFakes();
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeTransactionsRoutes(fakes))],
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

  function type(element: HTMLElement, testId: string, value: string): void {
    const field = query<HTMLInputElement>(element, testId)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
  }

  /** Abre el selector compartido y elige la opción con ese texto. */
  function choose(element: HTMLElement, testId: string, label: string, harness: RouterTestingHarness): void {
    element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"] [data-testid="select-trigger"]`)!.click();
    harness.detectChanges();
    [...element.querySelectorAll<HTMLElement>(`[data-testid="${testId}"] [role="option"]`)]
      .find((option) => option.textContent?.includes(label))!
      .click();
    harness.detectChanges();
  }

  /** Abre el selector, lee sus opciones y lo vuelve a cerrar. */
  function optionLabels(element: HTMLElement, testId: string, harness: RouterTestingHarness): string[] {
    const trigger = element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"] [data-testid="select-trigger"]`)!;
    trigger.click();
    harness.detectChanges();
    const labels = [...element.querySelectorAll(`[data-testid="${testId}"] [role="option"]`)].map(
      (option) => option.textContent!.trim(),
    );
    trigger.click();
    harness.detectChanges();

    return labels;
  }

  /** `href` del enlace fijo al pie del selector, que solo existe con la lista abierta. */
  function footerHref(element: HTMLElement, testId: string, linkId: string, harness: RouterTestingHarness): string | null {
    const trigger = element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"] [data-testid="select-trigger"]`)!;
    trigger.click();
    harness.detectChanges();
    const href = query(element, linkId)?.getAttribute('href') ?? null;
    trigger.click();
    harness.detectChanges();

    return href;
  }

  /** Fecha (`YYYY-MM-DD`) que tiene el selector de fecha. */
  function dateValue(element: HTMLElement): string {
    return query(element, 'date-picker-trigger')!.getAttribute('data-value')!;
  }

  /** La fecha `days` días antes o después de `date` (`YYYY-MM-DD`). */
  function shiftDate(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  }

  /** Abre el calendario, retrocede mes a mes hasta ver la fecha y la elige. */
  function pickDate(element: HTMLElement, date: string, harness: RouterTestingHarness): void {
    query(element, 'date-picker-trigger')!.click();
    harness.detectChanges();

    for (let months = 0; months < 24 && !element.querySelector(`[data-date="${date}"]`); months++) {
      click(element, 'date-picker-previous');
      harness.detectChanges();
    }

    element.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)!.click();
    harness.detectChanges();
  }

  function click(element: HTMLElement, testId: string): void {
    query(element, testId)!.click();
  }

  function submit(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  function submitButton(element: HTMLElement): HTMLButtonElement {
    return query<HTMLButtonElement>(element, 'transaction-submit')!;
  }

  it('opens beside the list with the type selector and only the usable accounts', async () => {
    const { harness, element } = await open('/transactions/new/expense');

    expect(query(element, 'transaction-list-page')).toBeTruthy();
    expect(query(element, 'type-expense')?.getAttribute('aria-current')).toBe('page');
    expect(query(element, 'type-income')?.getAttribute('href')).toBe('/transactions/new/income');
    expect(submitButton(element).textContent).toContain('Save expense');
    // Revolut (EUR) y Davivienda (desactivada) no se ofrecen.
    expect(optionLabels(element, 'transaction-account', harness)).toEqual([
      'Bancolombia · COP',
      'Nequi · COP',
      'Wise · USD',
    ]);
    expect(fakes.categories.lastType).toBe('expense');
    // Desde el selector se puede ir a crear una cuenta, como con el tipo de cuenta.
    expect(footerHref(element, 'transaction-account', 'create-account', harness)).toBe('/accounts/new');
  });

  it('redirects an unknown type back to the list', async () => {
    await RouterTestingHarness.create('/transactions/new/loan');

    expect(TestBed.inject(Router).url).toBe('/transactions');
  });

  it('validates locally before calling the backend', async () => {
    const { harness, element } = await open('/transactions/new/expense');

    type(element, 'transaction-amount', '12,3456');
    submit(element);
    harness.detectChanges();

    expect(query(element, 'amount-error')?.textContent).toContain('up to 2 decimals');
    expect(query(element, 'account-error')?.textContent).toContain('Pick the account the money comes out of.');
    expect(fakes.transactions.lastDraft).toBeNull();
  });

  it('creates an income with the chosen category and returns to the list with a notice', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { harness, element } = await open('/transactions/new/income');

    expect(query(element, 'amount-prefix')?.textContent).toContain('+');
    type(element, 'transaction-amount', '4.500.000');
    choose(element, 'transaction-account', 'Bancolombia', harness);
    expect(query(element, 'account-balance')?.textContent).toContain('1.250.000');
    // La categoría es obligatoria: no se ofrece «Sin categoría» y se explica para qué sirve.
    expect(optionLabels(element, 'transaction-category', harness)).toEqual(['Salario']);
    expect(query(element, 'transaction-category')?.textContent).toContain('Elige una categoría');
    expect(query(element, 'category-help')?.textContent).toContain('Así sabrás en qué se va tu dinero cada mes.');
    // Crear una categoría desde aquí propone el tipo del movimiento.
    expect(footerHref(element, 'transaction-category', 'create-category', harness)).toBe('/categories/new?type=income');
    choose(element, 'transaction-category', 'Salario', harness);
    type(element, 'transaction-description', '  Salario noviembre ');
    pickDate(element, '2026-11-01', harness);
    submit(element);
    await settle(harness);

    expect(fakes.transactions.lastDraft).toEqual({
      type: 'income',
      amount: 4500000,
      date: new Date(2026, 10, 1, 12).toISOString(),
      categoryId: 2,
      description: 'Salario noviembre',
      toAccountId: 2,
    });
    expect(fakes.transactions.lastDraft!.date.endsWith('Z')).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/transactions');
    expect(query(element, 'transaction-notice')?.textContent).toContain('Ingreso registrado');
    expect(query(element, 'transaction-notice')?.textContent).toContain('4.500.000');
    expect(fakes.transactions.lastQuery).toMatchObject({ page: 1, pageSize: 5 });
  });

  it('asks for a category before saving an expense', async () => {
    const { harness, element } = await open('/transactions/new/expense');

    type(element, 'transaction-amount', '52300');
    choose(element, 'transaction-account', 'Nequi', harness);
    submit(element);
    await settle(harness);

    const error = query(element, 'category-error')!;
    expect(error.textContent).toContain('Pick a category to save the expense.');
    expect(error.getAttribute('role')).toBe('alert');
    expect(query(element, 'category-help')).toBeNull();
    expect(
      element.querySelector('[data-testid="transaction-category"] [data-testid="select-trigger"]')?.getAttribute('aria-describedby'),
    ).toBe('transaction-category-error');
    expect(fakes.transactions.lastDraft).toBeNull();

    choose(element, 'transaction-category', 'Mercado', harness);
    expect(query(element, 'category-error')).toBeNull();
    submit(element);
    await settle(harness);

    expect(fakes.transactions.lastDraft).toMatchObject({
      type: 'expense',
      amount: 52300,
      categoryId: 1,
      description: null,
      fromAccountId: 3,
    });
  });

  it('offers to create the first category when the type has none', async () => {
    fakes.categories.categories = fakes.categories.categories.filter((category) => category.type !== 'income');
    const { harness, element } = await open('/transactions/new/income');

    expect(query(element, 'transaction-category')).toBeNull();
    expect(query(element, 'no-categories')?.textContent).toContain('You have no income categories yet.');
    expect(query(element, 'create-first-category')?.getAttribute('href')).toBe('/categories/new?type=income');

    type(element, 'transaction-amount', '1000');
    choose(element, 'transaction-account', 'Nequi', harness);
    submit(element);
    await settle(harness);

    expect(query(element, 'category-error')?.textContent).toContain('Create an income category first.');
    expect(fakes.transactions.lastDraft).toBeNull();
  });

  it('shows the same empty state for transfers and asks for a category first', async () => {
    fakes.categories.categories = fakes.categories.categories.filter((category) => category.type !== 'transfer');
    const { harness, element } = await open('/transactions/new/transfer');

    expect(query(element, 'transaction-category')).toBeNull();
    expect(query(element, 'no-categories')?.textContent).toContain('You have no transfer categories yet.');
    expect(query(element, 'create-first-category')?.getAttribute('href')).toBe('/categories/new?type=transfer');

    type(element, 'transaction-amount', '1000');
    choose(element, 'transaction-from', 'Bancolombia', harness);
    choose(element, 'transaction-to', 'Nequi', harness);
    submit(element);
    await settle(harness);

    expect(query(element, 'category-error')?.textContent).toContain('Create a transfer category first.');
    expect(fakes.transactions.lastDraft).toBeNull();
  });

  it('shows the backend category requirement next to the category', async () => {
    const { harness, element } = await open('/transactions/new/expense');
    fakes.transactions.failWith = new TransactionError('Required', TransactionErrorCode.CategoryRequired);

    type(element, 'transaction-amount', '1000');
    choose(element, 'transaction-account', 'Nequi', harness);
    choose(element, 'transaction-category', 'Mercado', harness);
    submit(element);
    await settle(harness);

    expect(query(element, 'category-error')?.textContent).toContain('Pick a category to save the transaction.');
    expect(query(element, 'form-error')).toBeNull();
  });

  it('transfers between accounts in the same currency without a conversion', async () => {
    const { harness, element } = await open('/transactions/new/transfer');

    // Las transferencias también exigen categoría, solo de su tipo y sin opción vacía.
    expect(fakes.categories.lastType).toBe('transfer');
    expect(optionLabels(element, 'transaction-category', harness)).toEqual(['Ahorro']);
    choose(element, 'transaction-category', 'Ahorro', harness);
    type(element, 'transaction-amount', '100000');
    choose(element, 'transaction-from', 'Bancolombia', harness);
    // El origen no se ofrece como destino.
    expect(optionLabels(element, 'transaction-to', harness)).toEqual(['Nequi · COP', 'Wise · USD']);
    choose(element, 'transaction-to', 'Nequi', harness);
    await settle(harness);

    expect(query(element, 'to-balance')?.textContent).toContain('85,000');
    expect(query(element, 'conversion')).toBeNull();
    expect(submitButton(element).textContent).toContain('Transfer');

    submit(element);
    await settle(harness);

    expect(fakes.transactions.lastDraft).toMatchObject({
      type: 'transfer',
      amount: 100000,
      categoryId: 4,
      fromAccountId: 2,
      toAccountId: 3,
    });
    expect(fakes.rates.requestedDates).toEqual([]);
  });

  it('shows the read-only amount that arrives in a COP to USD transfer', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { harness, element } = await open('/transactions/new/transfer');

    choose(element, 'transaction-from', 'Bancolombia', harness);
    choose(element, 'transaction-to', 'Wise', harness);
    type(element, 'transaction-amount', '400.000');
    choose(element, 'transaction-category', 'Ahorro', harness);
    await settle(harness);

    // La TRM se pide para la fecha elegida, que por defecto es hoy.
    expect(fakes.rates.requestedDates).toEqual([dateValue(element)]);
    const output = query(element, 'destination-amount')!;
    expect(output.tagName).toBe('OUTPUT');
    expect(output.textContent).toContain('US$');
    expect(output.textContent).toContain('101,27');
    expect(query(element, 'conversion')?.textContent).toContain('Calculado');
    expect(query(element, 'rate-value')?.textContent).toContain('3.950');
    expect(query(element, 'rate-formula')?.textContent).toContain('÷');

    submit(element);
    await settle(harness);

    expect(fakes.transactions.lastDraft).toMatchObject({ type: 'transfer', amount: 400000, fromAccountId: 2, toAccountId: 8 });
    expect(query(element, 'transaction-notice')?.textContent).toContain('llegaron');
    expect(query(element, 'transaction-notice')?.textContent).toContain('101,27');
  });

  it('does not offer deactivated categories', async () => {
    const { harness, element } = await open('/transactions/new/expense');

    expect(optionLabels(element, 'transaction-category', harness)).not.toContain('Arriendo viejo');
  });

  it('asks for the rate of the date picked in the calendar, never a future one', async () => {
    const { harness, element } = await open('/transactions/new/transfer');

    choose(element, 'transaction-from', 'Bancolombia', harness);
    choose(element, 'transaction-to', 'Wise', harness);
    const today = dateValue(element);
    const lastWeek = shiftDate(today, -7);
    pickDate(element, lastWeek, harness);
    await settle(harness);

    expect(dateValue(element)).toBe(lastWeek);
    expect(fakes.rates.requestedDates.at(-1)).toBe(lastWeek);

    query(element, 'date-picker-trigger')!.click();
    harness.detectChanges();
    const tomorrow = element.querySelector<HTMLButtonElement>(`[data-date="${shiftDate(today, 1)}"]`);
    // Mañana puede caer en el mes siguiente, que no se muestra; si se muestra, no se puede elegir.
    expect(tomorrow === null || tomorrow.disabled).toBe(true);
  });

  it('closes the calendar with Escape without closing the panel', async () => {
    const { harness, element } = await open('/transactions/new/expense');

    query(element, 'date-picker-trigger')!.click();
    harness.detectChanges();
    query(element, 'date-picker-popover')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(harness);

    expect(query(element, 'date-picker-popover')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/transactions/new/expense');
  });

  it('blocks the transfer when the exchange rate fails and lets the user retry', async () => {
    fakes.rates.failWith = new TransactionError(
      'The exchange rate is not available right now.',
      TransactionErrorCode.ExchangeRateUnavailable,
    );
    const { harness, element } = await open('/transactions/new/transfer');

    type(element, 'transaction-amount', '400000');
    choose(element, 'transaction-from', 'Bancolombia', harness);
    choose(element, 'transaction-to', 'Wise', harness);
    await settle(harness);

    expect(query(element, 'rate-error')?.textContent).toContain('not available');
    expect(submitButton(element).disabled).toBe(true);
    expect(query(element, 'destination-amount')).toBeNull();

    click(element, 'rate-retry');
    await settle(harness);

    expect(query(element, 'destination-amount')?.textContent).toContain('101.27');
    expect(submitButton(element).disabled).toBe(false);
  });

  it('shows a backend field error next to its field', async () => {
    const { harness, element } = await open('/transactions/new/expense');
    // Se fija después de abrir: el listado de fondo también consulta el repositorio.
    fakes.transactions.failWith = new TransactionError('Inactive', TransactionErrorCode.AccountInactive);

    type(element, 'transaction-amount', '1000');
    choose(element, 'transaction-account', 'Nequi', harness);
    choose(element, 'transaction-category', 'Mercado', harness);
    submit(element);
    await settle(harness);

    expect(query(element, 'account-error')?.textContent).toContain('That account is deactivated.');
    expect(query(element, 'form-error')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/transactions/new/expense');
  });

  it('shows errors that belong to no field at the form level', async () => {
    const { harness, element } = await open('/transactions/new/expense');
    fakes.transactions.failWith = new TransactionError('Something broke.');

    type(element, 'transaction-amount', '1000');
    choose(element, 'transaction-account', 'Nequi', harness);
    choose(element, 'transaction-category', 'Mercado', harness);
    submit(element);
    await settle(harness);

    expect(query(element, 'form-error')?.textContent).toContain('Something broke.');
  });

  it('closes with Escape while nothing changed', async () => {
    const { harness, element } = await open('/transactions/new/expense');

    query(element, 'transaction-panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/transactions');
  });
  describe('with a date in a closed month', () => {
    /** Cierra todos los meses anteriores al de `today` (este año y el pasado). */
    function closeMonthsBefore(today: string): void {
      const [year, month] = today.split('-').map(Number);

      for (const each of [year - 1, year]) {
        fakes.periods.years[each] = periodYear(
          each,
          Array.from({ length: 12 }, (_, index) =>
            each < year || index + 1 < month ? 'closed' : index + 1 === month ? 'current' : 'future',
          ),
        );
      }
    }

    /** Abre el formulario de gasto con monto y cuenta, y elige una fecha de hace 40 días. */
    async function openWithClosedDate() {
      const today = new Date();
      closeMonthsBefore(
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      );
      const opened = await open('/transactions/new/expense');
      const { harness, element } = opened;
      const closedDate = shiftDate(dateValue(element), -40);
      type(element, 'transaction-amount', '52300');
      choose(element, 'transaction-account', 'Nequi', harness);
      pickDate(element, closedDate, harness);
      await settle(harness);

      return { ...opened, closedDate };
    }

    it('does not show the note while the date is in an open month', async () => {
      const { element } = await open('/transactions/new/expense');

      expect(query(element, 'locked-date-note')).toBeNull();
      expect(submitButton(element).disabled).toBe(false);
    });

    it('explains the closed month and blocks saving until the date changes', async () => {
      const { harness, element } = await openWithClosedDate();

      expect(query(element, 'locked-date-note')?.textContent).toContain('is closed');
      expect(query(element, 'locked-date-note')?.textContent).toContain('To save this expense');
      expect(query(element, 'date-picker-trigger')?.getAttribute('aria-describedby')).toContain('transaction-date-locked');
      expect(submitButton(element).disabled).toBe(true);

      click(element, 'locked-date-today');
      await settle(harness);

      expect(query(element, 'locked-date-note')).toBeNull();
      expect(submitButton(element).disabled).toBe(false);
    });

    it('reopens the month from the note and offers to keep recording', async () => {
      const { harness, element, closedDate } = await openWithClosedDate();
      const [year, month] = closedDate.split('-').map(Number);

      click(element, 'locked-date-reopen');
      await settle(harness);
      expect(query(element, 'reopen-dialog')?.textContent).toContain('Reopen');

      query(element, 'reopen-dialog')!.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(harness);

      expect(fakes.periods.lastReopen).toEqual({ period: { year, month }, request: { recloseMode: 'auto', reason: null } });
      expect(query(element, 'locked-date-note')).toBeNull();
      expect(submitButton(element).disabled).toBe(false);
      expect(query(element, 'period-notice')?.textContent).toContain('It closes on its own tomorrow.');

      click(element, 'period-notice-keep-going');
      await settle(harness);

      expect(query(element, 'period-notice')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/transactions/new/expense');
    });

    it('locks the date when the backend says another device closed the month', async () => {
      const { harness, element } = await open('/transactions/new/expense');
      const [year] = dateValue(element).split('-').map(Number);
      const loads = fakes.periods.count(`year ${year}`);
      fakes.transactions.failWith = new TransactionError('Closed.', TransactionErrorCode.PeriodClosed);

      type(element, 'transaction-amount', '1000');
      choose(element, 'transaction-account', 'Nequi', harness);
      choose(element, 'transaction-category', 'Mercado', harness);
      submit(element);
      await settle(harness);

      expect(query(element, 'locked-date-note')?.textContent).toContain('is closed');
      expect(query(element, 'form-error')).toBeNull();
      expect(submitButton(element).disabled).toBe(true);
      // Se vuelve a consultar el año para traer el cierre hecho en el otro dispositivo.
      expect(fakes.periods.count(`year ${year}`)).toBe(loads + 1);
    });
  });
  describe('a credit card expense', () => {
    /** Espera el debounce del plan de cuotas (300 ms) y la respuesta del falso. */
    async function waitForPlan(harness: RouterTestingHarness): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await settle(harness);
    }

    beforeEach(() => {
      fakes.accounts.accounts.push({
        id: 20,
        name: 'Visa',
        currency: 'COP',
        currentBalance: -300000,
        isActive: true,
        isCreditCard: true,
        availableCredit: 1700000,
        nextStatementDate: '2026-11-15',
      });
    });

    /** Gasto con la tarjeta, el monto y la categoría Mercado. */
    async function openCardExpense(amount = '300000') {
      const opened = await open('/transactions/new/expense');
      const { harness, element } = opened;
      type(element, 'transaction-amount', amount);
      choose(element, 'transaction-account', 'Visa', harness);
      choose(element, 'transaction-category', 'Mercado', harness);
      await settle(harness);

      return opened;
    }

    it('offers installments only with a credit card', async () => {
      const { harness, element } = await open('/transactions/new/expense');
      choose(element, 'transaction-account', 'Nequi', harness);
      await settle(harness);
      expect(query(element, 'installments')).toBeNull();

      choose(element, 'transaction-account', 'Visa', harness);
      await settle(harness);

      expect(query(element, 'installments')).toBeTruthy();
      for (const count of [1, 3, 6, 12, 24]) {
        expect(query(element, `installments-${count}`)).toBeTruthy();
      }
      expect(query(element, 'installments-1')?.getAttribute('aria-checked')).toBe('true');
      expect(query(element, 'installments-custom')).toBeTruthy();
    });

    it('does not offer installments in an income or a transfer', async () => {
      const { harness, element } = await open('/transactions/new/income');
      choose(element, 'transaction-account', 'Visa', harness);
      await settle(harness);

      expect(query(element, 'installments')).toBeNull();
    });

    it('asks the backend for the plan after the debounce and shows it', async () => {
      const { harness, element } = await openCardExpense();

      click(element, 'installments-3');
      await settle(harness);
      // Antes del debounce no se pide nada.
      expect(fakes.transactions.lastPreview).toBeNull();

      await waitForPlan(harness);

      expect(fakes.transactions.lastPreview).toEqual({
        fromAccountId: 20,
        amount: 300000,
        date: expect.stringMatching(/Z$/),
        installments: 3,
        annualInterestRate: null,
        categoryId: 1,
      });
      expect(query(element, 'installments-plan')?.textContent).toContain('3 ×');
      expect(query(element, 'installments-plan')?.querySelectorAll('li')).toHaveLength(3);
      expect(query(element, 'installments-total')?.textContent).toContain('300,000');
    });

    it('describes a single installment', async () => {
      const { harness, element } = await openCardExpense();
      await waitForPlan(harness);

      expect(query(element, 'installments-plan')).toBeNull();
      expect(query(element, 'installments-single')?.textContent).toContain('A single installment of');
    });

    it('accepts another number of installments from 1 to 48', async () => {
      const { harness, element } = await openCardExpense();

      type(element, 'installments-custom', '49');
      await settle(harness);
      expect(query(element, 'installments-error')?.textContent).toContain('between 1 and 48');

      type(element, 'installments-custom', '18');
      await waitForPlan(harness);

      expect(query(element, 'installments-error')).toBeNull();
      expect(fakes.transactions.lastPreview?.installments).toBe(18);
      expect(query(element, 'installments-12')?.getAttribute('aria-checked')).toBe('false');
    });

    it('requires a rate from 0 to 200 when the purchase has interest', async () => {
      const { harness, element } = await openCardExpense();
      click(element, 'installments-6');
      await settle(harness);

      click(element, 'with-interest');
      await settle(harness);
      expect(submitButton(element).disabled).toBe(true);

      type(element, 'transaction-interest-rate', '');
      await settle(harness);
      expect(query(element, 'interest-rate-error')?.textContent).toContain('Enter the effective annual rate');

      type(element, 'transaction-interest-rate', '250');
      await settle(harness);
      expect(query(element, 'interest-rate-error')?.textContent).toContain('between 0 and 200');

      type(element, 'transaction-interest-rate', '28,5');
      await waitForPlan(harness);

      expect(query(element, 'interest-rate-error')).toBeNull();
      expect(submitButton(element).disabled).toBe(false);
      expect(fakes.transactions.lastPreview?.annualInterestRate).toBe(28.5);
    });

    it('sends the installments and the rate when saving', async () => {
      const { harness, element } = await openCardExpense();
      click(element, 'installments-12');
      await settle(harness);
      click(element, 'with-interest');
      await settle(harness);
      type(element, 'transaction-interest-rate', '24');
      await settle(harness);

      submit(element);
      await settle(harness);

      expect(fakes.transactions.lastDraft).toMatchObject({
        type: 'expense',
        fromAccountId: 20,
        installments: 12,
        annualInterestRate: 24,
      });
    });

    it('drops the rate when going back to no interest', async () => {
      const { harness, element } = await openCardExpense();
      click(element, 'installments-3');
      await settle(harness);
      click(element, 'with-interest');
      await settle(harness);
      type(element, 'transaction-interest-rate', '24');
      click(element, 'without-interest');
      await settle(harness);

      submit(element);
      await settle(harness);

      expect(fakes.transactions.lastDraft).toMatchObject({ installments: 3, annualInterestRate: null });
    });

    it('shows how the budget limits will rise, with no limit when a month has none', async () => {
      fakes.transactions.previewResult = {
        installmentAmount: 100000,
        totalInterest: 0,
        totalAmount: 300000,
        schedule: [
          { number: 1, year: 2026, month: 11, statementDate: '2026-11-15', principal: 100000, interest: 0, amount: 100000 },
          { number: 2, year: 2026, month: 12, statementDate: '2026-12-15', principal: 100000, interest: 0, amount: 100000 },
          { number: 3, year: 2027, month: 1, statementDate: '2027-01-15', principal: 100000, interest: 0, amount: 100000 },
        ],
        budgetAdjustments: [
          { year: 2026, month: 12, categoryId: 1, currency: 'COP', currentAmount: 800000, newAmount: 900000 },
          { year: 2027, month: 1, categoryId: 1, currency: 'COP', currentAmount: null, newAmount: 100000 },
        ],
      };
      const { harness, element } = await openCardExpense();
      click(element, 'installments-3');
      await waitForPlan(harness);

      const adjustments = query(element, 'budget-adjustments')!;
      expect(adjustments.textContent).toContain("We'll raise the Mercado budget in 2 months");
      const rows = [...adjustments.querySelectorAll('tbody tr')].map((row) => row.textContent ?? '');
      expect(rows[0]).toContain('800,000');
      expect(rows[0]).toContain('900,000');
      expect(rows[1]).toContain('No budget');
      expect(rows[1]).toContain('100,000');
    });

    it('shows the available credit before and after the purchase', async () => {
      const { element } = await openCardExpense('2000000');
      const credit = query(element, 'credit-after')!.textContent ?? '';

      expect(credit).toContain('Available credit on Visa');
      expect(credit).toContain('1,700,000');
      expect(credit).toContain('-');
      expect(credit).toContain('300,000');
      expect(credit).toContain('This purchase takes you over the limit');
    });

    it('shows a closed installment month with the button to reopen it', async () => {
      const { harness, element } = await openCardExpense();
      click(element, 'installments-3');
      await settle(harness);
      const [year, month] = dateValue(element).split('-').map(Number);
      const later = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
      fakes.transactions.failWith = new TransactionError('Closed.', TransactionErrorCode.PeriodClosed, later);

      submit(element);
      await settle(harness);

      expect(query(element, 'installment-month-closed')?.textContent).toContain('which is closed');
      expect(query(element, 'installment-month-closed')?.querySelector('[data-testid="reopen-period"]')).toBeTruthy();
      expect(query(element, 'locked-date-note')).toBeNull();
      expect(query(element, 'form-error')).toBeNull();

      click(element, 'installments-1');
      await settle(harness);
      expect(query(element, 'installment-month-closed')).toBeNull();
    });

    it('locks the date when PERIOD_CLOSED brings the month of the date', async () => {
      const { harness, element } = await openCardExpense();
      const [year, month] = dateValue(element).split('-').map(Number);
      fakes.transactions.failWith = new TransactionError('Closed.', TransactionErrorCode.PeriodClosed, { year, month });

      submit(element);
      await settle(harness);

      expect(query(element, 'installment-month-closed')).toBeNull();
      expect(query(element, 'locked-date-note')?.textContent).toContain('is closed');
    });

    it('shows the installment errors of the backend beside the installments', async () => {
      const { harness, element } = await openCardExpense();
      fakes.transactions.failWith = new TransactionError('Out', TransactionErrorCode.InstallmentsOutOfRange);

      submit(element);
      await settle(harness);

      expect(query(element, 'installments-error')).toBeTruthy();
      expect(query(element, 'form-error')).toBeNull();
    });
  });

  describe('paying a card from its statement', () => {
    const PAY_URL = '/transactions/new/transfer?payCard=20&statement=2026-10&due=150000';

    beforeEach(() => {
      fakes.accounts.accounts.push(
        {
          id: 20,
          name: 'Visa',
          currency: 'COP',
          currentBalance: -300000,
          isActive: true,
          isCreditCard: true,
          availableCredit: 1700000,
          nextStatementDate: '2026-11-15',
        },
        {
          id: 21,
          name: 'Amex',
          currency: 'USD',
          currentBalance: -200,
          isActive: true,
          isCreditCard: true,
          availableCredit: null,
          nextStatementDate: '2026-11-20',
        },
      );
      fakes.categories.categories.push({ id: 7, name: 'Pago tarjeta', type: 'transfer', isActive: true, code: 'CARD_PAYMENT' });
    });

    function amount(element: HTMLElement): string {
      return query<HTMLInputElement>(element, 'transaction-amount')!.value;
    }

    it('fixes the card as destination, picks the card payment category and names the statement', async () => {
      const { element } = await open(PAY_URL);

      expect(element.querySelector('#transaction-panel-title')?.textContent).toContain('Pay Visa');
      expect(element.querySelector('#transaction-panel-title + p')?.textContent).toContain('October 2026 statement');
      expect(query(element, 'transaction-to')?.textContent).toContain('Visa');
      expect(query(element, 'transaction-category')?.textContent).toContain('Card payment');
      expect(query<HTMLTextAreaElement>(element, 'transaction-description')!.value).toBe('Statement payment October 2026');
    });

    it('names the statement in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open(PAY_URL);

      expect(query<HTMLTextAreaElement>(element, 'transaction-description')!.value).toBe('Pago extracto octubre 2026');
    });

    /** Abre el pago y elige Bancolombia como origen: el monto sugerido se escribe en su moneda. */
    async function openPayment(url = PAY_URL) {
      const opened = await open(url);
      choose(opened.element, 'transaction-from', 'Bancolombia', opened.harness);
      await settle(opened.harness);

      return opened;
    }

    it('does not write the suggested amount until the source account is chosen', async () => {
      const { element } = await open(PAY_URL);

      expect(query(element, 'pay-preset-statement')?.getAttribute('aria-pressed')).toBe('true');
      expect(amount(element)).toBe('');
    });

    it('offers the statement amount and the whole debt, starting with the statement', async () => {
      const { harness, element } = await openPayment();

      expect(query(element, 'pay-preset-statement')?.textContent).toContain('150,000');
      expect(query(element, 'pay-preset-statement')?.getAttribute('aria-pressed')).toBe('true');
      expect(query(element, 'pay-preset-all')?.textContent).toContain('300,000');
      expect(amount(element)).toBe('150000');

      click(element, 'pay-preset-all');
      await settle(harness);

      expect(amount(element)).toBe('300000');
      expect(query(element, 'pay-preset-all')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('starts with the whole debt when the statement is not given', async () => {
      const { element } = await openPayment('/transactions/new/transfer?payCard=20');

      expect(query(element, 'pay-preset-statement')).toBeNull();
      expect(amount(element)).toBe('300000');
    });

    it('lets go of the preset when another amount is typed', async () => {
      const { harness, element } = await openPayment();

      type(element, 'transaction-amount', '50000');
      await settle(harness);

      expect(query(element, 'pay-preset-statement')?.getAttribute('aria-pressed')).toBe('false');
      expect(query(element, 'pay-preset-all')?.getAttribute('aria-pressed')).toBe('false');
      expect(amount(element)).toBe('50000');
    });

    it('converts the preset with the rate of the date when the currencies differ', async () => {
      const { harness, element } = await open('/transactions/new/transfer?payCard=21&statement=2026-10&due=150.25');
      choose(element, 'transaction-from', 'Bancolombia', harness);
      await settle(harness);

      // USD → COP multiplica por la TRM y redondea a 2 decimales: 150,25 × 3.950.
      expect(amount(element)).toBe('593487.5');
      expect(fakes.rates.requestedDates.at(-1)).toBe(dateValue(element));

      click(element, 'pay-preset-all');
      await settle(harness);
      expect(amount(element)).toBe('790000');
    });

    it('shows how the source account and the card debt end', async () => {
      const { harness, element } = await open(PAY_URL);
      choose(element, 'transaction-from', 'Bancolombia', harness);
      await settle(harness);

      const outcome = query(element, 'payment-outcome')!.textContent ?? '';
      expect(outcome).toContain('Bancolombia ends at');
      expect(outcome).toContain('1,100,000');
      expect(outcome).toContain('Visa debt ends at');
      expect(outcome).toContain('150,000');
    });

    it('sends the transfer to the card and goes back to the statement', async () => {
      const { harness, element } = await open(PAY_URL);
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      choose(element, 'transaction-from', 'Bancolombia', harness);
      await settle(harness);

      submit(element);
      await settle(harness);

      expect(fakes.transactions.lastDraft).toMatchObject({
        type: 'transfer',
        amount: 150000,
        fromAccountId: 2,
        toAccountId: 20,
        categoryId: 7,
        description: 'Statement payment October 2026',
      });
      expect(navigate).toHaveBeenCalledWith(['/accounts', 20, 'statement'], { queryParams: { month: '2026-10' } });
    });

    it('closes back to the statement of the month', async () => {
      const { element } = await open(PAY_URL);

      expect(query(element, 'close-panel')?.getAttribute('href')).toBe('/accounts/20/statement?month=2026-10');
    });
  });
});
