import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import {
  CategoryKind,
  ExchangeRate,
  Transaction,
  TransactionAccountOption,
  TransactionCategoryOption,
  TransactionDraft,
  TransactionPage,
  TransactionQuery,
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
  GetExchangeRateUseCase,
  ListTransactionAccountOptionsUseCase,
  ListTransactionCategoryOptionsUseCase,
  ListTransactionsUseCase,
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

  list(query: TransactionQuery): Observable<TransactionPage> {
    this.queries.push(query);
    return of({ items: [TRANSACTION], page: query.page, pageSize: query.pageSize, totalItems: 1 });
  }

  create(draft: TransactionDraft): Observable<Transaction> {
    this.drafts.push(draft);
    return of(TRANSACTION);
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
    });
    return of([account(1, 'Wise'), account(2, 'ahorros'), account(3, 'Ávila'), account(4, 'Nequi')]);
  }
}

class MemoryCategoryOptionsRepository extends TransactionCategoryOptionsRepository {
  kinds: (CategoryKind | undefined)[] = [];

  list(kind?: CategoryKind): Observable<TransactionCategoryOption[]> {
    this.kinds.push(kind);
    return of([
      { id: 1, name: 'Salario', kind: 'income', isActive: true },
      { id: 2, name: 'arriendo', kind: 'expense', isActive: true },
      { id: 3, name: 'Éxtras', kind: 'both', isActive: true },
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
      .execute({ page: 2, pageSize: 5, type: 'expense' })
      .subscribe((value) => (result = value));

    expect(transactions.queries).toEqual([{ page: 2, pageSize: 5, type: 'expense' }]);
    expect(result?.items).toEqual([TRANSACTION]);
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

  it('sorts the account options by name ignoring case and accents', () => {
    let names: string[] = [];
    TestBed.inject(ListTransactionAccountOptionsUseCase)
      .execute()
      .subscribe((value) => (names = value.map((account) => account.name)));

    expect(names).toEqual(['ahorros', 'Ávila', 'Nequi', 'Wise']);
  });

  it('passes the kind and sorts the category options by name', () => {
    let names: string[] = [];
    TestBed.inject(ListTransactionCategoryOptionsUseCase)
      .execute('expense')
      .subscribe((value) => (names = value.map((category) => category.name)));

    expect(categories.kinds).toEqual(['expense']);
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
});
