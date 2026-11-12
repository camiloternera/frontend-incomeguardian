import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import {
  ExchangeRate,
  InstallmentPreview,
  InstallmentPreviewRequest,
  Transaction,
  TransactionAccountOption,
  TransactionCategoryOption,
  TransactionDraft,
  TransactionPage,
  TransactionQuery,
  TransactionRange,
  TransactionSummary,
  TransactionType,
} from '../domain/transaction';
import {
  ExchangeRateRepository,
  TransactionAccountOptionsRepository,
  TransactionCategoryOptionsRepository,
  TransactionRepository,
} from '../domain/transaction.repository';
import { TRANSACTION_USE_CASES } from '../transactions.providers';
import {
  CreateTransactionUseCase,
  DeleteTransactionUseCase,
  GetExchangeRateUseCase,
  GetTransactionUseCase,
  PreviewInstallmentsUseCase,
  SummarizeTransactionsUseCase,
  ListTransactionAccountOptionsUseCase,
  ListTransactionCategoryOptionsUseCase,
  ListTransactionsUseCase,
  UpdateTransactionUseCase,
} from './transaction-use-cases';

const TRANSACTION: Transaction = {
  id: 1,
  type: 'expense',
  amount: 45000,
  date: '2026-11-01T15:00:00Z',
  fromAccountId: 2,
  toAccountId: null,
  categoryId: null,
  description: null,
  fromCurrency: 'COP',
  toCurrency: null,
  destinationAmount: null,
  exchangeRate: null,
  exchangeRateDate: null,
  installments: 1,
  annualInterestRate: null,
  installmentAmount: null,
  schedule: [],
  canModify: true,
};

const PREVIEW: InstallmentPreview = {
  installmentAmount: 15000,
  totalInterest: 0,
  totalAmount: 45000,
  schedule: [],
  budgetAdjustments: [],
};

const RATE: ExchangeRate = {
  base: 'USD',
  quote: 'COP',
  rate: 3950,
  validFrom: '2026-11-01',
  validTo: '2026-11-01',
  source: 'BanRep',
};

/** Movimientos en memoria que anotan lo que reciben. */
class MemoryTransactionRepository extends TransactionRepository {
  queries: TransactionQuery[] = [];
  drafts: TransactionDraft[] = [];
  ranges: TransactionRange[] = [];
  ids: number[] = [];
  updates: { id: number; draft: TransactionDraft }[] = [];
  removed: number[] = [];
  previews: InstallmentPreviewRequest[] = [];

  list(query: TransactionQuery): Observable<TransactionPage> {
    this.queries.push(query);
    return of({ items: [TRANSACTION], page: query.page, pageSize: query.pageSize, totalItems: 1 });
  }

  summary(range: TransactionRange): Observable<TransactionSummary> {
    this.ranges.push(range);
    return of({ totalItems: 1, currencies: [] });
  }

  create(draft: TransactionDraft): Observable<Transaction> {
    this.drafts.push(draft);
    return of(TRANSACTION);
  }

  get(id: number): Observable<Transaction> {
    this.ids.push(id);
    return of({ ...TRANSACTION, id });
  }

  update(id: number, draft: TransactionDraft): Observable<Transaction> {
    this.updates.push({ id, draft });
    return of({ ...TRANSACTION, id });
  }

  remove(id: number): Observable<void> {
    this.removed.push(id);
    return of(undefined);
  }

  previewInstallments(request: InstallmentPreviewRequest): Observable<InstallmentPreview> {
    this.previews.push(request);
    return of(PREVIEW);
  }
}

class MemoryAccountOptionsRepository extends TransactionAccountOptionsRepository {
  list(): Observable<TransactionAccountOption[]> {
    const account = (id: number, name: string): TransactionAccountOption => ({
      id,
      name,
      currency: 'COP',
      currentBalance: 0,
      isActive: true,
      isCreditCard: false,
      availableCredit: null,
      nextStatementDate: null,
    });
    return of([account(1, 'Wise'), account(2, 'ahorros'), account(3, 'Ávila'), account(4, 'Nequi')]);
  }
}

class MemoryCategoryOptionsRepository extends TransactionCategoryOptionsRepository {
  types: (TransactionType | undefined)[] = [];

  list(type?: TransactionType): Observable<TransactionCategoryOption[]> {
    this.types.push(type);
    return of([
      { id: 1, name: 'Salario', type: 'income', isActive: true, code: null },
      { id: 2, name: 'arriendo', type: 'expense', isActive: true, code: null },
      { id: 3, name: 'Éxtras', type: 'expense', isActive: true, code: null },
    ]);
  }
}

class MemoryExchangeRateRepository extends ExchangeRateRepository {
  dates: (string | undefined)[] = [];

  trm(date?: string): Observable<ExchangeRate> {
    this.dates.push(date);
    return of(RATE);
  }
}

describe('transaction use cases', () => {
  let transactions: MemoryTransactionRepository;
  let categories: MemoryCategoryOptionsRepository;
  let rates: MemoryExchangeRateRepository;

  beforeEach(() => {
    transactions = new MemoryTransactionRepository();
    categories = new MemoryCategoryOptionsRepository();
    rates = new MemoryExchangeRateRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: TransactionRepository, useValue: transactions },
        { provide: TransactionAccountOptionsRepository, useClass: MemoryAccountOptionsRepository },
        { provide: TransactionCategoryOptionsRepository, useValue: categories },
        { provide: ExchangeRateRepository, useValue: rates },
        ...TRANSACTION_USE_CASES,
      ],
    });
  });

  it('lists transactions with the given query', () => {
    let result: TransactionPage | undefined;
    TestBed.inject(ListTransactionsUseCase)
      .execute({ page: 1, pageSize: 5, fromDate: 'a', toDate: 'b' })
      .subscribe((value) => (result = value));

    expect(transactions.queries).toEqual([{ page: 1, pageSize: 5, fromDate: 'a', toDate: 'b' }]);
    expect(result?.items).toEqual([TRANSACTION]);
  });

  it('asks the summary of a range', () => {
    let result: TransactionSummary | undefined;
    TestBed.inject(SummarizeTransactionsUseCase)
      .execute({ fromDate: 'a', toDate: 'b' })
      .subscribe((value) => (result = value));

    expect(transactions.ranges).toEqual([{ fromDate: 'a', toDate: 'b' }]);
    expect(result?.totalItems).toBe(1);
  });

  it('trims the description before creating', () => {
    TestBed.inject(CreateTransactionUseCase)
      .execute({
        type: 'expense',
        amount: 45000,
        date: '2026-11-01T15:00:00.000Z',
        fromAccountId: 2,
        categoryId: 4,
        description: '  Mercado  ',
      })
      .subscribe();

    expect(transactions.drafts[0].description).toBe('Mercado');
    expect(transactions.drafts[0]).toMatchObject({ type: 'expense', fromAccountId: 2, categoryId: 4 });
  });

  it('sends a blank description as null', () => {
    const create = TestBed.inject(CreateTransactionUseCase);
    const draft: TransactionDraft = {
      type: 'income',
      amount: 1,
      date: '2026-11-01T15:00:00.000Z',
      toAccountId: 3,
      categoryId: null,
      description: '   ',
    };

    create.execute(draft).subscribe();
    create.execute({ ...draft, description: null }).subscribe();

    expect(transactions.drafts.map((value) => value.description)).toEqual([null, null]);
  });

  it('trims the description before updating and keeps the id', () => {
    let result: Transaction | undefined;
    TestBed.inject(UpdateTransactionUseCase)
      .execute(7, {
        type: 'expense',
        amount: 45000,
        date: '2026-11-01T15:00:00.000Z',
        fromAccountId: 2,
        categoryId: 4,
        description: '  Mercado  ',
      })
      .subscribe((value) => (result = value));

    expect(transactions.updates).toHaveLength(1);
    expect(transactions.updates[0].id).toBe(7);
    expect(transactions.updates[0].draft).toMatchObject({ type: 'expense', fromAccountId: 2, categoryId: 4, description: 'Mercado' });
    expect(transactions.drafts).toEqual([]);
    expect(result?.id).toBe(7);
  });

  it('sends a blank description as null when updating', () => {
    TestBed.inject(UpdateTransactionUseCase)
      .execute(7, { type: 'income', amount: 1, date: '2026-11-01T15:00:00.000Z', toAccountId: 3, categoryId: null, description: '   ' })
      .subscribe();

    expect(transactions.updates[0].draft.description).toBeNull();
  });

  it('deletes a transaction by id', () => {
    let completed = false;
    TestBed.inject(DeleteTransactionUseCase)
      .execute(7)
      .subscribe({ complete: () => (completed = true) });

    expect(transactions.removed).toEqual([7]);
    expect(completed).toBe(true);
  });

  it('sorts the account options by name ignoring case and accents', () => {
    let names: string[] = [];
    TestBed.inject(ListTransactionAccountOptionsUseCase)
      .execute()
      .subscribe((value) => (names = value.map((account) => account.name)));

    expect(names).toEqual(['ahorros', 'Ávila', 'Nequi', 'Wise']);
  });

  it('passes the type and sorts the category options by name', () => {
    let names: string[] = [];
    TestBed.inject(ListTransactionCategoryOptionsUseCase)
      .execute('expense')
      .subscribe((value) => (names = value.map((category) => category.name)));

    expect(categories.types).toEqual(['expense']);
    expect(names).toEqual(['arriendo', 'Éxtras', 'Salario']);
  });

  it('asks for the rate of the given date', () => {
    let result: ExchangeRate | undefined;
    const useCase = TestBed.inject(GetExchangeRateUseCase);
    useCase.execute('2026-11-01').subscribe((value) => (result = value));
    useCase.execute().subscribe();

    expect(rates.dates).toEqual(['2026-11-01', undefined]);
    expect(result).toEqual(RATE);
  });

  it('gets one transaction by id', () => {
    let result: Transaction | undefined;
    TestBed.inject(GetTransactionUseCase)
      .execute(7)
      .subscribe((value) => (result = value));

    expect(transactions.ids).toEqual([7]);
    expect(result?.id).toBe(7);
  });

  it('asks the backend for the installment plan', () => {
    const request: InstallmentPreviewRequest = {
      fromAccountId: 9,
      amount: 45000,
      date: '2026-11-01T15:00:00.000Z',
      installments: 3,
      annualInterestRate: null,
      categoryId: 4,
    };
    let result: InstallmentPreview | undefined;
    TestBed.inject(PreviewInstallmentsUseCase)
      .execute(request)
      .subscribe((value) => (result = value));

    expect(transactions.previews).toEqual([request]);
    expect(result).toEqual(PREVIEW);
  });
});
