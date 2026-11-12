import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { throwError } from 'rxjs';
import { InstallmentScheduleItem } from '../../../domain/transaction';
import { TransactionError, TransactionErrorCode } from '../../../domain/transaction-error';
import { TransactionFakes, fakeTransactionsRoutes, transaction } from '../../transaction-repository.fake';
import { installmentState } from './transaction-detail.component';

function item(number: number, year: number, month: number, amount = 25000, interest = 0): InstallmentScheduleItem {
  return {
    number,
    year,
    month,
    statementDate: `${year}-${String(month).padStart(2, '0')}-15`,
    principal: amount - interest,
    interest,
    amount,
  };
}

/** Plan de 4 cuotas: octubre, noviembre, diciembre y enero; la tarjeta corta el 15. */
const SCHEDULE = [item(1, 2026, 10, 26000, 1000), item(2, 2026, 11, 25800, 800), item(3, 2026, 12), item(4, 2027, 1)];

describe('installmentState', () => {
  it('compares the statement date of the installment with the next statement of the card', () => {
    expect(installmentState(item(1, 2026, 10), '2026-11-15')).toBe('billed');
    expect(installmentState(item(2, 2026, 11), '2026-11-15')).toBe('current');
    expect(installmentState(item(3, 2026, 12), '2026-11-15')).toBe('pending');
  });

  it('treats every installment as pending without a next statement', () => {
    expect(installmentState(item(1, 2020, 1), null)).toBe('pending');
  });
});

describe('TransactionDetailComponent', () => {
  let fakes: TransactionFakes;

  beforeEach(async () => {
    localStorage.clear();
    fakes = new TransactionFakes();
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
    fakes.transactions.transactions.push(
      transaction(41, 'expense', 100000, {
        date: '2026-10-10T17:00:00Z',
        fromAccountId: 20,
        fromCurrency: 'COP',
        categoryId: 1,
        description: 'Televisor',
        installments: 4,
        annualInterestRate: 24.5,
        installmentAmount: 25000,
        schedule: SCHEDULE,
      }),
    );
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter([...fakeTransactionsRoutes(fakes), { path: '**', children: [] }])],
    }).compileComponents();
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  function query(element: HTMLElement, testId: string): HTMLElement | null {
    return element.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  }

  function text(element: HTMLElement, testId: string): string {
    return query(element, testId)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('opens beside the list with the purchase and its installments', async () => {
    const { element } = await open('/transactions/41');

    expect(query(element, 'transaction-list-page')).toBeTruthy();
    expect(query(element, 'transaction-detail')?.textContent).toContain('Televisor');
    expect(text(element, 'detail-amount')).toContain('100,000');
    expect(query(element, 'transaction-detail')?.textContent).toContain('4 installments of');
    expect(query(element, 'transaction-detail')?.textContent).toContain('24.5% EA');
  });

  it('marks each installment as billed, current or pending', async () => {
    const { element } = await open('/transactions/41');

    expect(text(element, 'installment-1')).toContain('Billed');
    expect(text(element, 'installment-2')).toContain('On the current statement');
    expect(text(element, 'installment-3')).toContain('Pending');
    expect(text(element, 'installment-4')).toContain('Pending');
  });

  it('counts only the pending installments as remaining', async () => {
    const { element } = await open('/transactions/41');

    expect(text(element, 'detail-remaining')).toBe('2 installments · COP50,000');
  });

  it('links to the statement of the current installment', async () => {
    const { element } = await open('/transactions/41');
    const link = query(element, 'detail-statement-link')!;

    expect(link.getAttribute('href')).toBe('/accounts/20/statement?month=2026-11');
    expect(link.textContent).toContain('View the November statement');
  });

  it('has no statement link when no installment is on the current statement', async () => {
    fakes.accounts.accounts = fakes.accounts.accounts.map((account) =>
      account.id === 20 ? { ...account, nextStatementDate: '2027-03-15' } : account,
    );
    const { element } = await open('/transactions/41');

    expect(query(element, 'detail-statement-link')).toBeNull();
    expect(text(element, 'detail-remaining')).toContain('0 installments');
  });

  it('says when the first installment fell in the month after the purchase', async () => {
    fakes.transactions.transactions = fakes.transactions.transactions.map((item) =>
      item.id === 41 ? { ...item, date: '2026-09-20T17:00:00Z' } : item,
    );
    const { element } = await open('/transactions/41');

    expect(query(element, 'transaction-detail')?.textContent).toContain('the first installment fell in October');
  });

  it('links the budget of the month of the current installment', async () => {
    const { element } = await open('/transactions/41');

    expect(element.querySelector('a[href^="/budgets"]')?.getAttribute('href')).toBe('/budgets?month=2026-11');
  });

  it('links the budget of the first installment when none is on the current statement', async () => {
    fakes.accounts.accounts = fakes.accounts.accounts.map((account) =>
      account.id === 20 ? { ...account, nextStatementDate: '2027-03-15' } : account,
    );
    const { element } = await open('/transactions/41');

    expect(element.querySelector('a[href^="/budgets"]')?.getAttribute('href')).toBe('/budgets?month=2026-10');
  });

  it('names the budget of its category', async () => {
    const { element } = await open('/transactions/41');

    expect(query(element, 'transaction-detail')?.textContent).toContain('Mercado budget');
  });

  it('explains when the transaction does not exist', async () => {
    const { element } = await open('/transactions/404');

    expect(query(element, 'detail-not-found')).toBeTruthy();
  });

  it('shows any other error', async () => {
    // El listado también usa `failWith`: el fallo se fuerza solo en `get`.
    fakes.transactions.get = () => throwError(() => new TransactionError('Server down'));
    const { element } = await open('/transactions/41');

    expect(text(element, 'detail-error')).toBe('Server down');
  });

  it('only opens numeric ids', async () => {
    await open('/transactions/abc?month=2026-10');

    expect(TestBed.inject(Router).url).toBe('/transactions?month=2026-10');
  });

  it('translates the states into Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open('/transactions/41');

    expect(text(element, 'installment-1')).not.toContain('Billed');
    expect(text(element, 'detail-remaining')).toContain('2');
    expect(query(element, 'transaction-detail')?.textContent).toContain('24,5 % EA');
  });

  describe('editing and deleting', () => {
    async function settle(harness: RouterTestingHarness): Promise<void> {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    it('links to the edit panel keeping the filters of the list', async () => {
      const { element } = await open('/transactions/41?month=2026-10');

      expect(query(element, 'detail-edit')?.getAttribute('href')).toBe('/transactions/41/edit?month=2026-10');
      expect(text(element, 'detail-edit')).toBe('Edit');
      expect(text(element, 'detail-delete')).toBe('Delete');
      expect(query(element, 'detail-locked')).toBeNull();
    });

    it('explains why a locked transaction cannot change', async () => {
      fakes.transactions.transactions = fakes.transactions.transactions.map((item) =>
        item.id === 41 ? { ...item, canModify: false } : item,
      );
      const { element } = await open('/transactions/41');

      expect(text(element, 'detail-locked')).toContain('Can’t be edited or deleted');
      expect(query(element, 'detail-edit')).toBeNull();
      expect(query(element, 'detail-delete')).toBeNull();
    });

    it('asks to confirm and cancels without deleting', async () => {
      const { harness, element } = await open('/transactions/41');

      query(element, 'detail-delete')!.click();
      await settle(harness);

      expect(text(element, 'delete-confirmation')).toContain('Delete “Televisor”?');
      expect(query(element, 'detail-edit')).toBeNull();

      query(element, 'cancel-delete')!.click();
      await settle(harness);

      expect(query(element, 'delete-confirmation')).toBeNull();
      expect(query(element, 'detail-edit')).toBeTruthy();
      expect(fakes.transactions.removed).toEqual([]);
    });

    it('deletes and goes back to the list keeping its filters', async () => {
      const { harness, element } = await open('/transactions/41?month=2026-10');

      query(element, 'detail-delete')!.click();
      await settle(harness);
      query(element, 'confirm-delete')!.click();
      await settle(harness);

      expect(fakes.transactions.removed).toEqual([41]);
      expect(TestBed.inject(Router).url).toBe('/transactions?month=2026-10');
      expect(text(element, 'transaction-notice')).toContain('Transaction deleted');
    });

    it('keeps the detail open with the reason when the month was closed meanwhile', async () => {
      const { harness, element } = await open('/transactions/41');
      fakes.transactions.remove = () =>
        throwError(() => new TransactionError('The month of that date is closed.', TransactionErrorCode.PeriodClosed));

      query(element, 'detail-delete')!.click();
      await settle(harness);
      query(element, 'confirm-delete')!.click();
      await settle(harness);

      expect(text(element, 'delete-error')).toBe('The month of that date is closed.');
      expect(query(element, 'confirm-delete')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/transactions/41');
    });

    it('translates the actions into Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open('/transactions/41');

      expect(text(element, 'detail-edit')).toBe('Editar');
      expect(text(element, 'detail-delete')).toBe('Eliminar');
    });
  });

  describe('a card advance', () => {
    beforeEach(() => {
      fakes.transactions.transactions.push(
        // El avance fue después del corte de septiembre: la primera cuota cae en octubre.
        transaction(42, 'transfer', 100000, {
          date: '2026-09-20T17:00:00Z',
          fromAccountId: 20,
          toAccountId: 2,
          fromCurrency: 'COP',
          toCurrency: 'COP',
          categoryId: 4,
          isCardAdvance: true,
          installments: 4,
          annualInterestRate: 24.5,
          installmentAmount: 25000,
          schedule: SCHEDULE,
          advanceFee: 15000,
          feeTransactionId: 43,
        }),
        transaction(43, 'expense', 15000, {
          date: '2026-09-20T17:00:00Z',
          fromAccountId: 20,
          fromCurrency: 'COP',
          categoryId: 1,
          parentTransactionId: 42,
          canModify: false,
        }),
      );
    });

    /** Título del detalle; el primer h2 de la página es el del mes del listado. */
    function title(element: HTMLElement): string {
      return query(element, 'transaction-detail')!.querySelector('h2')!.textContent!.replace(/\s+/g, ' ').trim();
    }

    async function askDelete(harness: RouterTestingHarness, element: HTMLElement): Promise<void> {
      query(element, 'detail-delete')!.click();
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    it('names the advance with its category and its fee', async () => {
      const { element } = await open('/transactions/42');

      expect(text(element, 'transaction-detail')).toContain('Advance · Ahorro');
      expect(title(element)).toBe('Advance');
      expect(text(element, 'detail-advance-fee')).toMatch(/^Fee .*15,000$/);
      expect(text(element, 'transaction-detail')).toContain('4 installments of');
    });

    it('says the advance was after the statement closed', async () => {
      const { element } = await open('/transactions/42');

      expect(text(element, 'transaction-detail')).toContain(
        "The advance was after its month's statement closed, so the first installment fell in October.",
      );
    });

    it('explains how the advance counts in the budget', async () => {
      const { element } = await open('/transactions/42');
      const detail = text(element, 'transaction-detail');

      expect(detail).toContain('The advance in your budget');
      expect(detail).toContain('The advance itself is not spending.');
      expect(detail).not.toContain('Ahorro budget');
    });

    it('warns that deleting it also deletes its fee', async () => {
      const { harness, element } = await open('/transactions/42');

      await askDelete(harness, element);

      expect(text(element, 'delete-confirmation')).toContain('Delete “Advance”?');
      expect(text(element, 'delete-advance-fee')).toBe('Its bank fee is deleted too.');
    });

    it('sends the fee to its advance', async () => {
      const { element } = await open('/transactions/43?month=2026-09');

      expect(title(element)).toBe('Advance fee');
      expect(text(element, 'detail-managed')).toContain(
        'This fee is part of a cash advance: change or delete it from the advance.',
      );
      expect(query(element, 'detail-open-advance')?.getAttribute('href')).toBe('/transactions/42?month=2026-09');
      expect(query(element, 'detail-locked')).toBeNull();
      expect(query(element, 'detail-edit')).toBeNull();
      expect(query(element, 'detail-delete')).toBeNull();
    });

    it('opens the advance from its fee', async () => {
      const { harness, element } = await open('/transactions/43');

      query(element, 'detail-open-advance')!.click();
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Router).url).toBe('/transactions/42');
      expect(text(element, 'detail-advance-fee')).toMatch(/15,000$/);
    });

    it('keeps the detail when the backend says it is managed by an advance', async () => {
      const { harness, element } = await open('/transactions/42');
      fakes.transactions.remove = () =>
        throwError(() => new TransactionError('Managed by its advance.', TransactionErrorCode.ManagedByParent));

      await askDelete(harness, element);
      query(element, 'confirm-delete')!.click();
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(text(element, 'delete-error')).toBe('Managed by its advance.');
      expect(query(element, 'confirm-delete')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/transactions/42');
    });

    it('speaks of the advance in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open('/transactions/42');

      expect(text(element, 'transaction-detail')).toContain('Avance · Ahorro');
      expect(text(element, 'detail-advance-fee')).toMatch(/^Comisión .*15\.000$/);
      expect(text(element, 'transaction-detail')).toContain('El avance en el presupuesto');
      expect(text(element, 'transaction-detail')).toContain('El avance fue después del corte de su mes');
    });

    it('names the fee in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open('/transactions/43');

      expect(title(element)).toBe('Comisión del avance');
      expect(text(element, 'detail-open-advance')).toBe('Abrir avance');
    });
  });

});
