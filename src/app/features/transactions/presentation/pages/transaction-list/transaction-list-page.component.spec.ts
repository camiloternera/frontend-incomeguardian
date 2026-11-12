import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { periodYear } from '@features/periods/testing';
import {
  TransactionMonth,
  dayOf,
  formatMonthKey,
  monthOfDay,
  monthRange,
  shiftMonth,
} from '../../../domain/transaction';
import { TransactionError, TransactionErrorCode } from '../../../domain/transaction-error';
import { TransactionFakes, fakeTransactionsRoutes, transaction } from '../../transaction-repository.fake';
import { TransactionWorkspace } from '../../transaction-workspace';
import { TransactionListPageComponent } from './transaction-list-page.component';

/** Hoy en hora de Colombia: el mes en curso depende del reloj real. */
const TODAY = dayOf(new Date().toISOString());
const CURRENT: TransactionMonth = monthOfDay(TODAY);
const PREVIOUS = shiftMonth(CURRENT, -1);

/** Mediodía en Colombia (17:00 UTC) del día indicado del mes. */
function noonOf(month: TransactionMonth, day: number): string {
  return `${formatMonthKey(month)}-${String(day).padStart(2, '0')}T17:00:00Z`;
}

describe('TransactionListPageComponent', () => {
  let fakes: TransactionFakes;

  async function open(url = '/transactions') {
    const harness = await RouterTestingHarness.create(url);
    await settle(harness);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  async function settle(harness: RouterTestingHarness): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function query(element: HTMLElement, testId: string): HTMLElement | null {
    return element.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  }

  function text(element: HTMLElement, testId: string): string {
    return query(element, testId)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function texts(element: HTMLElement, testId: string): string[] {
    return [...element.querySelectorAll(`[data-testid="${testId}"]`)].map(
      (item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    fakes = new TransactionFakes();
    // Los movimientos de ejemplo caen hoy, para que aparezcan en el mes en curso.
    fakes.transactions.transactions = fakes.transactions.transactions.map((item) => ({
      ...item,
      date: `${TODAY}T17:00:00Z`,
    }));
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeTransactionsRoutes(fakes))],
    }).compileComponents();
  });

  it('opens on the current month, grouped by day, with names and the month summary', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open();

    expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5, ...monthRange(CURRENT) });
    expect(fakes.transactions.summaryRanges).toEqual([monthRange(CURRENT)]);
    expect(query(element, 'month-next')?.hasAttribute('disabled')).toBe(true);
    expect(query(element, 'month-previous')?.getAttribute('aria-label')).toBe('Mes anterior');

    // Un solo grupo: todo es de hoy.
    expect(texts(element, 'day-title')).toHaveLength(1);
    expect(text(element, 'day-title')).toMatch(/^Hoy /);
    expect(text(element, 'day-count')).toBe('3 movimientos');
    expect(texts(element, 'row-description')).toEqual(['Mercado semanal', 'Salario', 'Transferencia']);

    const expense = query(element, 'transaction-1')!;
    expect(expense.querySelector('[data-testid="row-meta"]')?.textContent).toContain('Mercado · Bancolombia');
    expect(expense.querySelector('[data-testid="row-amount"]')?.textContent).toContain('−');
    expect(expense.querySelector('[data-testid="row-amount"]')?.textContent).toContain('52.300');

    const transfer = query(element, 'transaction-3')!;
    expect(transfer.querySelector('[data-testid="row-meta"]')?.textContent).toContain('Bancolombia → Wise');
    expect(transfer.querySelector('[data-testid="row-destination"]')?.textContent).toContain('US$');
    expect(transfer.querySelector('[data-testid="row-destination"]')?.textContent).toContain('101,27');

    // Entró y salió no cuentan las transferencias; el total sí.
    expect(text(element, 'summary-income')).toContain('4.500.000');
    expect(text(element, 'summary-expense')).toContain('52.300');
    expect(text(element, 'summary-count')).toBe('3');
  });

  it('keeps each currency apart in the summary', async () => {
    fakes.transactions.transactions.push(
      transaction(20, 'income', 250.5, { toAccountId: 8, toCurrency: 'USD', date: `${TODAY}T17:00:00Z` }),
    );
    const { element } = await open();

    expect(text(element, 'summary-income')).toMatch(/4,500,000.* · .*250\.50/);
  });

  it('puts the create action at the top of the page', async () => {
    const { element } = await open();

    expect(element.querySelector('header [data-testid="new-transaction"]')?.getAttribute('href')).toBe(
      '/transactions/new/expense',
    );
  });

  it('steps back a month through ?month= and returns to the current one', async () => {
    const { harness, element } = await open();

    query(element, 'month-previous')!.click();
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe(`/transactions?month=${formatMonthKey(PREVIOUS)}`);
    expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5, ...monthRange(PREVIOUS) });
    expect(query(element, 'month-next')?.hasAttribute('disabled')).toBe(false);

    query(element, 'month-next')!.click();
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/transactions');
    expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5, ...monthRange(CURRENT) });
  });

  it('groups a past month by weekday with the count of each day', async () => {
    fakes.transactions.transactions = [
      transaction(30, 'expense', 1000, { fromAccountId: 3, description: 'Taxi', date: noonOf(PREVIOUS, 12) }),
      transaction(31, 'expense', 2000, { fromAccountId: 3, description: 'Café', date: noonOf(PREVIOUS, 12) }),
      transaction(32, 'income', 3000, { toAccountId: 2, description: 'Reembolso', date: noonOf(PREVIOUS, 10) }),
    ];
    const { element } = await open(`/transactions?month=${formatMonthKey(PREVIOUS)}`);

    const weekday = (day: number) =>
      new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
        new Date(Date.UTC(PREVIOUS.year, PREVIOUS.month - 1, day)),
      );
    const groups = [...element.querySelectorAll('[data-testid="day-group"]')];

    expect(groups.map((group) => group.getAttribute('data-day'))).toEqual([
      `${formatMonthKey(PREVIOUS)}-12`,
      `${formatMonthKey(PREVIOUS)}-10`,
    ]);
    expect(texts(element, 'day-title')[0]).toMatch(new RegExp(`^${weekday(12)} \\w+ 12$`));
    expect(texts(element, 'day-count')).toEqual(['2 transactions', '1 transaction']);
  });

  it('never opens a future month', async () => {
    await open(`/transactions?month=${formatMonthKey(shiftMonth(CURRENT, 1))}`);

    expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5, ...monthRange(CURRENT) });
  });

  it('marks a closed month', async () => {
    fakes.periods.years[PREVIOUS.year] = periodYear(
      PREVIOUS.year,
      Array.from({ length: 12 }, (_, index) => (index + 1 === PREVIOUS.month ? 'closed' : 'pending')),
    );
    const { element } = await open(`/transactions?month=${formatMonthKey(PREVIOUS)}`);

    expect(text(element, 'closed-month-badge')).toContain('Month closed');
  });

  it('shows the empty month and goes back to the current one', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { harness, element } = await open(`/transactions?month=${formatMonthKey(PREVIOUS)}`);
    const name = new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(PREVIOUS.year, PREVIOUS.month - 1, 15)),
    );

    expect(text(element, 'transaction-empty')).toContain(`Sin movimientos en ${name}`);
    expect(query(element, 'transaction-rows')).toBeNull();
    expect(text(element, 'summary-income')).toContain('0');

    query(element, 'go-to-current-month')!.click();
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/transactions');
    expect(query(element, 'go-to-current-month')).toBeNull();
  });

  it('pages within the month', async () => {
    for (let id = 10; id < 16; id++) {
      fakes.transactions.transactions.push(
        transaction(id, 'expense', 1000, { fromAccountId: 3, date: `${TODAY}T17:00:00Z` }),
      );
    }
    const { harness, element } = await open();

    query(element, 'pagination-next')!.click();
    harness.detectChanges();

    expect(fakes.transactions.lastQuery).toEqual({ page: 2, pageSize: 5, ...monthRange(CURRENT) });
  });

  it('offers a retry when the list fails to load', async () => {
    fakes.transactions.failWith = new TransactionError('The service is down.');
    const { harness, element } = await open();

    expect(text(element, 'load-error')).toContain('The service is down.');

    query(element, 'retry')!.click();
    harness.detectChanges();

    expect(texts(element, 'row-description')).toHaveLength(3);
  });
  describe('card purchases and system categories', () => {
    it('marks a purchase in installments and links its description to the detail', async () => {
      fakes.transactions.transactions.push(
        transaction(41, 'expense', 300000, {
          date: `${TODAY}T18:00:00Z`,
          fromAccountId: 2,
          categoryId: 1,
          description: 'Televisor',
          installments: 6,
          installmentAmount: 50000,
        }),
      );
      const { element } = await open('/transactions?month=' + formatMonthKey(CURRENT));
      const row = query(element, 'transaction-41')!;

      expect(row.querySelector('[data-testid="row-installments"]')?.textContent?.trim()).toBe('6 installments');
      const link = row.querySelector<HTMLAnchorElement>('a[data-testid="row-description"]')!;
      expect(link.textContent?.trim()).toBe('Televisor');
      expect(link.getAttribute('href')).toBe(`/transactions/41?month=${formatMonthKey(CURRENT)}`);
    });

    it('keeps a single-installment description as plain text', async () => {
      const { element } = await open();
      const row = query(element, 'transaction-1')!;

      expect(row.querySelector('[data-testid="row-installments"]')).toBeNull();
      expect(row.querySelector('a[data-testid="row-description"]')).toBeNull();
      expect(row.querySelector('[data-testid="row-description"]')?.textContent?.trim()).toBe('Mercado semanal');
    });

    it('names a system category by its code', async () => {
      // Las transferencias no muestran su categoría en la fila: se prueba con un gasto.
      fakes.categories.categories.push({ id: 7, name: 'Pago tarjeta', type: 'expense', isActive: true, code: 'CARD_PAYMENT' });
      fakes.transactions.transactions.push(
        transaction(50, 'expense', 150000, {
          date: `${TODAY}T18:00:00Z`,
          fromAccountId: 2,
          categoryId: 7,
          description: 'Pago extracto',
        }),
      );
      const { element } = await open();

      expect(query(element, 'transaction-50')?.querySelector('[data-testid="row-meta"]')?.textContent).toContain('Card payment');
    });
  });

  describe('editing and deleting from the row', () => {
    function menuOf(element: HTMLElement, id: number): HTMLButtonElement {
      return query(element, `menu-${id}`) as HTMLButtonElement;
    }

    async function openMenu(harness: RouterTestingHarness, element: HTMLElement, id: number): Promise<void> {
      menuOf(element, id).click();
      await settle(harness);
    }

    async function askDelete(harness: RouterTestingHarness, element: HTMLElement, id: number): Promise<void> {
      await openMenu(harness, element, id);
      query(element, `delete-${id}`)!.click();
      await settle(harness);
    }

    it('gives every row a closed actions menu named after the transaction', async () => {
      const { element } = await open();
      const menu = menuOf(element, 1);

      expect(menu.id).toBe('transaction-menu-button-1');
      expect(menu.getAttribute('aria-label')).toBe('Actions for Mercado semanal');
      expect(menu.getAttribute('aria-expanded')).toBe('false');
      expect(query(element, 'edit-1')).toBeNull();
      // Sin descripción, la transferencia se nombra por su tipo.
      expect(menuOf(element, 3).getAttribute('aria-label')).toBe('Actions for Transfer');
    });

    it('offers edit and delete when the transaction can change', async () => {
      const { harness, element } = await open(`/transactions?month=${formatMonthKey(CURRENT)}`);

      await openMenu(harness, element, 1);

      expect(menuOf(element, 1).getAttribute('aria-expanded')).toBe('true');
      expect(menuOf(element, 1).getAttribute('aria-controls')).toBe('transaction-menu-1');
      expect(query(element, 'edit-1')?.getAttribute('href')).toBe(`/transactions/1/edit?month=${formatMonthKey(CURRENT)}`);
      expect(text(element, 'delete-1')).toBe('Delete');
      expect(query(element, 'locked-1')).toBeNull();
    });

    it('opens one menu at a time and closes it on a second click', async () => {
      const { harness, element } = await open();

      await openMenu(harness, element, 1);
      await openMenu(harness, element, 2);

      expect(query(element, 'edit-1')).toBeNull();
      expect(query(element, 'edit-2')).toBeTruthy();

      await openMenu(harness, element, 2);

      expect(query(element, 'edit-2')).toBeNull();
    });

    it('explains why a locked transaction cannot change', async () => {
      fakes.transactions.transactions = fakes.transactions.transactions.map((item) =>
        item.id === 1 ? { ...item, canModify: false } : item,
      );
      const { harness, element } = await open();

      await openMenu(harness, element, 1);

      expect(text(element, 'locked-1')).toContain('Can’t be edited or deleted');
      expect(query(element, 'edit-1')).toBeNull();
      expect(query(element, 'delete-1')).toBeNull();
    });

    it('closes the menu with Escape and gives the focus back to its button', async () => {
      const { harness, element } = await open();
      await openMenu(harness, element, 1);

      query(element, 'edit-1')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle(harness);

      expect(query(element, 'edit-1')).toBeNull();
      expect(document.activeElement).toBe(menuOf(element, 1));
    });

    it('closes the menu on a click outside', async () => {
      const { harness, element } = await open();
      await openMenu(harness, element, 1);

      document.body.click();
      await settle(harness);

      expect(query(element, 'edit-1')).toBeNull();
    });

    it('keeps the menu open on a click inside it', async () => {
      const { harness, element } = await open();
      await openMenu(harness, element, 1);

      query(element, 'edit-1')!.parentElement!.click();
      await settle(harness);

      expect(query(element, 'edit-1')).toBeTruthy();
    });

    it('asks to confirm the deletion inside the row', async () => {
      const { harness, element } = await open();

      await askDelete(harness, element, 1);

      const confirmation = query(element, 'transaction-1')!.querySelector('[data-testid="delete-confirmation"]');
      expect(confirmation).toBeTruthy();
      expect(confirmation?.textContent).toContain('Delete “Mercado semanal”?');
      expect(confirmation?.textContent).toContain('This can’t be undone');
      expect(query(element, 'edit-1')).toBeNull();
      expect(fakes.transactions.removed).toEqual([]);
    });

    it('cancels the deletion and gives the focus back to the menu button', async () => {
      const { harness, element } = await open();
      await askDelete(harness, element, 1);

      query(element, 'cancel-delete')!.click();
      await settle(harness);

      expect(query(element, 'delete-confirmation')).toBeNull();
      expect(document.activeElement).toBe(menuOf(element, 1));
      expect(fakes.transactions.removed).toEqual([]);
    });

    it('deletes, confirms it and reloads from the first page', async () => {
      for (let id = 10; id < 16; id++) {
        fakes.transactions.transactions.push(transaction(id, 'expense', 1000, { fromAccountId: 3, date: `${TODAY}T17:00:00Z` }));
      }
      const { harness, element } = await open();
      query(element, 'pagination-next')!.click();
      await settle(harness);
      const summaries = fakes.transactions.summaryRanges.length;

      await askDelete(harness, element, 15);
      query(element, 'confirm-delete')!.click();
      await settle(harness);

      expect(fakes.transactions.removed).toEqual([15]);
      expect(text(element, 'transaction-notice')).toContain('Transaction deleted');
      expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5, ...monthRange(CURRENT) });
      expect(fakes.transactions.summaryRanges.length).toBe(summaries + 1);
      expect(query(element, 'delete-confirmation')).toBeNull();
      expect(query(element, 'transaction-15')).toBeNull();
    });

    it('confirms the deletion in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { harness, element } = await open();
      await askDelete(harness, element, 1);

      expect(text(element, 'delete-confirmation')).toContain('¿Eliminar «Mercado semanal»?');

      query(element, 'confirm-delete')!.click();
      await settle(harness);

      expect(text(element, 'transaction-notice')).toContain('Movimiento eliminado');
    });

    it.each([
      [TransactionErrorCode.PeriodClosed, 'The month of that date is closed.'],
      [TransactionErrorCode.NotFound, 'It no longer exists.'],
    ])('shows why %s blocked the deletion and reloads the list', async (code, message) => {
      const { harness, element } = await open();
      await askDelete(harness, element, 1);
      const summaries = fakes.transactions.summaryRanges.length;
      fakes.transactions.failWith = new TransactionError(message, code);

      query(element, 'confirm-delete')!.click();
      await settle(harness);

      // El aviso sobrevive a la recarga, que retira la confirmación de la fila.
      expect(text(element, 'list-delete-error')).toContain(message);
      expect(query(element, 'list-delete-error')?.getAttribute('role')).toBe('alert');
      expect(query(element, 'delete-confirmation')).toBeNull();
      expect(fakes.transactions.summaryRanges.length).toBe(summaries + 1);
      expect(query(element, 'transaction-notice')).toBeNull();

      query(element, 'list-delete-error')!.querySelector('button')!.click();
      await settle(harness);

      expect(query(element, 'list-delete-error')).toBeNull();
    });

    it('keeps the confirmation with a retry for any other failure', async () => {
      const { harness, element } = await open();
      await askDelete(harness, element, 1);
      fakes.transactions.failWith = new TransactionError('The service is down.');

      query(element, 'confirm-delete')!.click();
      await settle(harness);

      expect(text(element, 'delete-error')).toBe('The service is down.');
      expect(query(element, 'confirm-delete')).toBeTruthy();
      expect(query(element, 'list-delete-error')).toBeNull();

      query(element, 'confirm-delete')!.click();
      await settle(harness);

      expect(fakes.transactions.removed).toEqual([1, 1]);
      expect(text(element, 'transaction-notice')).toContain('Transaction deleted');
    });

    it('clears an old delete error when asking to delete again', async () => {
      const { harness, element } = await open();
      await askDelete(harness, element, 1);
      fakes.transactions.failWith = new TransactionError('Closed.', TransactionErrorCode.PeriodClosed);
      query(element, 'confirm-delete')!.click();
      await settle(harness);

      await askDelete(harness, element, 2);

      expect(query(element, 'list-delete-error')).toBeNull();
    });
  });

  describe('card advances', () => {
    const MONTH = `?month=${formatMonthKey(CURRENT)}`;

    /** Avance de Bancolombia a Nequi (las cuentas del falso), con comisión y su gasto hijo. */
    function addAdvance(changes: Parameters<typeof transaction>[3] = {}): void {
      fakes.transactions.transactions.push(
        transaction(60, 'transfer', 600000, {
          date: `${TODAY}T18:00:00Z`,
          fromAccountId: 2,
          toAccountId: 3,
          fromCurrency: 'COP',
          toCurrency: 'COP',
          isCardAdvance: true,
          advanceFee: 15000,
          feeTransactionId: 61,
          ...changes,
        }),
      );
    }

    function addFee(changes: Parameters<typeof transaction>[3] = {}): void {
      fakes.transactions.transactions.push(
        transaction(61, 'expense', 15000, {
          date: `${TODAY}T18:00:00Z`,
          fromAccountId: 2,
          fromCurrency: 'COP',
          categoryId: 9,
          parentTransactionId: 60,
          canModify: false,
          ...changes,
        }),
      );
    }

    function inRow(element: HTMLElement, id: number, testId: string): HTMLElement | null {
      return query(element, `transaction-${id}`)!.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    }

    async function openMenu(harness: RouterTestingHarness, element: HTMLElement, id: number): Promise<void> {
      query(element, `menu-${id}`)!.click();
      await settle(harness);
    }

    it('marks a one-installment advance, names it and links it to the detail', async () => {
      addAdvance();
      const { element } = await open(`/transactions${MONTH}`);

      expect(inRow(element, 60, 'row-advance')?.textContent?.trim()).toBe('Advance');
      expect(inRow(element, 60, 'row-installments')).toBeNull();
      const link = query(element, 'transaction-60')!.querySelector<HTMLAnchorElement>('a[data-testid="row-description"]')!;
      expect(link.textContent?.trim()).toBe('Advance');
      expect(link.getAttribute('href')).toBe(`/transactions/60${MONTH}`);
      expect(inRow(element, 60, 'row-advance-fee')?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/^Fee .*15,000$/);
    });

    it('keeps the description and the installments of an advance', async () => {
      addAdvance({ description: 'Avance viaje', installments: 6 });
      const { element } = await open();

      expect(inRow(element, 60, 'row-description')?.textContent?.trim()).toBe('Avance viaje');
      expect(inRow(element, 60, 'row-advance')).toBeTruthy();
      expect(inRow(element, 60, 'row-installments')?.textContent?.trim()).toBe('6 installments');
    });

    it('shows no fee for an advance without one nor for other rows', async () => {
      addAdvance({ advanceFee: null, feeTransactionId: null });
      const { element } = await open();

      expect(inRow(element, 60, 'row-advance')).toBeTruthy();
      expect(element.querySelector('[data-testid="row-advance-fee"]')).toBeNull();
      expect(inRow(element, 1, 'row-advance')).toBeNull();
    });

    it('names the fee of an advance without description', async () => {
      addFee();
      const { element } = await open();

      expect(inRow(element, 61, 'row-description')?.textContent?.trim()).toBe('Advance fee');
    });

    it('sends the fee to its advance instead of offering edit or delete', async () => {
      addAdvance();
      addFee();
      const { harness, element } = await open(`/transactions${MONTH}`);

      await openMenu(harness, element, 61);

      expect(text(element, 'managed-61')).toBe('This fee is part of a cash advance: change or delete it from the advance.');
      expect(query(element, 'open-advance-61')?.getAttribute('href')).toBe(`/transactions/60${MONTH}`);
      expect(text(element, 'open-advance-61')).toBe('Open advance');
      expect(query(element, 'locked-61')).toBeNull();
      expect(query(element, 'edit-61')).toBeNull();
      expect(query(element, 'delete-61')).toBeNull();
    });

    it('keeps the locked note for a locked row that is not a fee', async () => {
      fakes.transactions.transactions = fakes.transactions.transactions.map((item) =>
        item.id === 1 ? { ...item, canModify: false } : item,
      );
      const { harness, element } = await open();

      await openMenu(harness, element, 1);

      expect(query(element, 'locked-1')).toBeTruthy();
      expect(query(element, 'managed-1')).toBeNull();
    });

    it('speaks of advances in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      addAdvance();
      addFee();
      const { element } = await open();

      expect(inRow(element, 60, 'row-advance')?.textContent?.trim()).toBe('Avance');
      expect(inRow(element, 60, 'row-description')?.textContent?.trim()).toBe('Avance');
      expect(inRow(element, 60, 'row-advance-fee')?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/^Comisión .*15\.000$/);
      expect(inRow(element, 61, 'row-description')?.textContent?.trim()).toBe('Comisión del avance');
    });

    it('warns that deleting an advance also deletes its fee', async () => {
      addAdvance();
      const { harness, element } = await open();

      await openMenu(harness, element, 60);
      query(element, 'delete-60')!.click();
      await settle(harness);

      expect(text(element, 'delete-confirmation')).toContain('Delete “Advance”?');
      expect(text(element, 'delete-advance-fee')).toBe('Its bank fee is deleted too.');
    });

    it('does not mention a fee when the transaction has none', async () => {
      const { harness, element } = await open();

      await openMenu(harness, element, 1);
      query(element, 'delete-1')!.click();
      await settle(harness);

      expect(query(element, 'delete-confirmation')).toBeTruthy();
      expect(query(element, 'delete-advance-fee')).toBeNull();
    });

    it('blocks and reloads when the backend says the transaction belongs to an advance', async () => {
      const { harness, element } = await open();
      await openMenu(harness, element, 1);
      query(element, 'delete-1')!.click();
      await settle(harness);
      const summaries = fakes.transactions.summaryRanges.length;
      fakes.transactions.failWith = new TransactionError('Belongs to an advance.', TransactionErrorCode.ManagedByParent);

      query(element, 'confirm-delete')!.click();
      await settle(harness);

      expect(text(element, 'list-delete-error')).toContain('Belongs to an advance.');
      expect(query(element, 'delete-confirmation')).toBeNull();
      expect(fakes.transactions.summaryRanges.length).toBe(summaries + 1);
    });

    it.each(['saved', 'updated', 'removed'] as const)(
      'asks for the categories again after %s, so a new one names its rows',
      async (change) => {
        addFee({ parentTransactionId: null, canModify: true, description: 'Cuota de manejo' });
        const { harness, element } = await open();

        expect(inRow(element, 61, 'row-meta')?.textContent).not.toContain('Bank fees');

        // El primer avance con comisión crea la categoría de sistema en el backend.
        fakes.categories.categories.push({ id: 9, name: 'Comisiones', type: 'expense', isActive: true, code: 'BANK_FEES' });
        const workspace = harness.fixture.debugElement
          .query(By.directive(TransactionListPageComponent))
          .injector.get(TransactionWorkspace);
        if (change === 'saved') {
          workspace.saved(fakes.transactions.transactions[0]);
        } else {
          workspace[change]();
        }
        await settle(harness);

        expect(inRow(element, 61, 'row-meta')?.textContent).toContain('Bank fees');
      },
    );
  });

});
