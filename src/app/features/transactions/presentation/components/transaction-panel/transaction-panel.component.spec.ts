import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
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
    expect(fakes.categories.lastKind).toBe('expense');
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
    expect(optionLabels(element, 'transaction-category', harness)[0]).toBe('Sin categoría');
    expect(footerHref(element, 'transaction-category', 'create-category', harness)).toBe('/categories/new');
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
    expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5 });
  });

  it('creates an expense from the chosen account without a category', async () => {
    const { harness, element } = await open('/transactions/new/expense');

    type(element, 'transaction-amount', '52300');
    choose(element, 'transaction-account', 'Nequi', harness);
    submit(element);
    await settle(harness);

    expect(fakes.transactions.lastDraft).toMatchObject({
      type: 'expense',
      amount: 52300,
      categoryId: null,
      description: null,
      fromAccountId: 3,
    });
  });

  it('transfers between accounts in the same currency without a conversion', async () => {
    const { harness, element } = await open('/transactions/new/transfer');

    expect(query(element, 'transaction-category')).toBeNull();
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
      categoryId: null,
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
});
