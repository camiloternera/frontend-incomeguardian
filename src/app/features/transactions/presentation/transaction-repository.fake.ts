import { Routes } from '@angular/router';
import { FakePeriodRepository, provideFakePeriods } from '@features/periods/testing';
import { Observable, of, throwError } from 'rxjs';
import {
  CurrencySummary,
  ExchangeRate,
  Transaction,
  TransactionAccountOption,
  TransactionCategoryOption,
  TransactionCurrency,
  TransactionDraft,
  TransactionPage,
  TransactionQuery,
  TransactionRange,
  TransactionSummary,
  TransactionType,
  previewDestinationAmount,
} from '../domain/transaction';
import {
  ExchangeRateRepository,
  TransactionAccountOptionsRepository,
  TransactionCategoryOptionsRepository,
  TransactionRepository,
} from '../domain/transaction.repository';
import { transactionsRoutes } from '../transactions.routes';

/** Devuelve el error pendiente (una sola vez) o el valor calculado. */
function respond<T>(owner: { failWith: unknown }, value: () => T): Observable<T> {
  const error = owner.failWith;
  owner.failWith = null;

  if (error) {
    return throwError(() => error);
  }

  try {
    return of(value());
  } catch (thrown) {
    return throwError(() => thrown);
  }
}

/** Cuentas en memoria: dos en pesos, una en dólares, una en euros y una desactivada. */
export class FakeTransactionAccountOptionsRepository extends TransactionAccountOptionsRepository {
  accounts: TransactionAccountOption[] = [
    { id: 2, name: 'Bancolombia', currency: 'COP', currentBalance: 1250000, isActive: true },
    { id: 3, name: 'Nequi', currency: 'COP', currentBalance: 85000, isActive: true },
    { id: 8, name: 'Wise', currency: 'USD', currentBalance: 320.5, isActive: true },
    { id: 9, name: 'Revolut', currency: 'EUR', currentBalance: 40, isActive: true },
    { id: 10, name: 'Davivienda', currency: 'COP', currentBalance: 0, isActive: false },
  ];
  failWith: unknown = null;

  list(): Observable<TransactionAccountOption[]> {
    return respond(this, () => [...this.accounts]);
  }
}

/** Categorías en memoria de cada tipo; recuerda el último tipo pedido. */
export class FakeTransactionCategoryOptionsRepository extends TransactionCategoryOptionsRepository {
  categories: TransactionCategoryOption[] = [
    { id: 1, name: 'Mercado', type: 'expense', isActive: true },
    { id: 2, name: 'Salario', type: 'income', isActive: true },
    { id: 3, name: 'Transporte', type: 'expense', isActive: true },
    { id: 4, name: 'Ahorro', type: 'transfer', isActive: true },
    { id: 5, name: 'Arriendo viejo', type: 'expense', isActive: false },
  ];
  failWith: unknown = null;
  lastType: TransactionType | undefined = undefined;

  list(type?: TransactionType): Observable<TransactionCategoryOption[]> {
    this.lastType = type;

    return respond(this, () => this.categories.filter((category) => type === undefined || category.type === type));
  }
}

/** TRM en memoria: 3.950 pesos por dólar; recuerda las fechas consultadas. */
export class FakeExchangeRateRepository extends ExchangeRateRepository {
  rate: ExchangeRate = {
    base: 'USD',
    quote: 'COP',
    rate: 3950,
    validFrom: '2026-11-01',
    validTo: '2026-11-03',
    source: 'BanRep',
  };
  failWith: unknown = null;
  requestedDates: (string | undefined)[] = [];

  trm(date?: string): Observable<ExchangeRate> {
    this.requestedDates.push(date);

    return respond(this, () => this.rate);
  }
}

/** Movimientos en memoria; filtra y pagina como el backend y recuerda la última consulta y el último borrador. */
export class FakeTransactionRepository extends TransactionRepository {
  transactions: Transaction[] = [
    transaction(1, 'expense', 52300, { fromAccountId: 2, fromCurrency: 'COP', categoryId: 1, description: 'Mercado semanal' }),
    transaction(2, 'income', 4500000, { toAccountId: 2, toCurrency: 'COP', categoryId: 2, description: 'Salario' }),
    transaction(3, 'transfer', 400000, {
      fromAccountId: 2,
      toAccountId: 8,
      fromCurrency: 'COP',
      toCurrency: 'USD',
      destinationAmount: 101.27,
      exchangeRate: 3950,
      exchangeRateDate: '2026-11-02',
    }),
  ];
  failWith: unknown = null;
  lastQuery: TransactionQuery | null = null;
  /** Rangos pedidos al resumen, en orden. */
  summaryRanges: TransactionRange[] = [];
  /** Error que devolverá la próxima consulta del resumen; el listado usa `failWith`. */
  summaryFailWith: unknown = null;
  lastDraft: TransactionDraft | null = null;
  /** TRM con la que el falso calcula el monto destino de una transferencia entre monedas. */
  rate = 3950;

  constructor(private readonly accounts?: FakeTransactionAccountOptionsRepository) {
    super();
  }

  list(query: TransactionQuery): Observable<TransactionPage> {
    this.lastQuery = query;

    return respond(this, () => {
      const matching = this.transactions.filter(
        (item) =>
          (query.fromDate === undefined || item.date >= query.fromDate) &&
          (query.toDate === undefined || item.date <= query.toDate),
      );
      const start = (query.page - 1) * query.pageSize;

      return {
        items: matching.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        totalItems: matching.length,
      };
    });
  }

  /** Suma como el backend: cada moneda aparte, ingresos en la destino y gastos en la origen. */
  summary(range: TransactionRange): Observable<TransactionSummary> {
    this.summaryRanges.push(range);
    const owner = { failWith: this.summaryFailWith };
    this.summaryFailWith = null;

    return respond(owner, () => {
      const matching = this.transactions.filter((item) => item.date >= range.fromDate && item.date <= range.toDate);
      const byCurrency = new Map<string, CurrencySummary>();
      const entry = (currency: string) => {
        const current = byCurrency.get(currency) ?? {
          currency,
          income: 0,
          expense: 0,
          transfersIn: 0,
          transfersOut: 0,
          net: 0,
        };
        byCurrency.set(currency, current);
        return current;
      };

      for (const item of matching) {
        const from = item.fromCurrency ?? this.currencyOf(item.fromAccountId) ?? 'COP';
        const to = item.toCurrency ?? this.currencyOf(item.toAccountId) ?? 'COP';

        if (item.type === 'income') {
          entry(to).income += item.amount;
        } else if (item.type === 'expense') {
          entry(from).expense += item.amount;
        } else {
          entry(from).transfersOut += item.amount;
          entry(to).transfersIn += item.destinationAmount ?? item.amount;
        }
      }

      const currencies = [...byCurrency.values()]
        .map((item) => ({ ...item, net: item.income + item.transfersIn - item.expense - item.transfersOut }))
        .sort((a, b) => a.currency.localeCompare(b.currency));

      return { totalItems: matching.length, currencies };
    });
  }

  create(draft: TransactionDraft): Observable<Transaction> {
    this.lastDraft = draft;

    return respond(this, () => {
      const fromAccountId = draft.type === 'income' ? null : draft.fromAccountId;
      const toAccountId = draft.type === 'expense' ? null : draft.toAccountId;
      const fromCurrency = this.currencyOf(fromAccountId);
      const toCurrency = this.currencyOf(toAccountId);
      const cross = draft.type === 'transfer' && fromCurrency !== toCurrency;
      const created = transaction(99, draft.type, draft.amount, {
        date: draft.date,
        categoryId: draft.categoryId,
        description: draft.description,
        fromAccountId,
        toAccountId,
        fromCurrency,
        toCurrency,
        destinationAmount: cross
          ? previewDestinationAmount(
              draft.amount,
              fromCurrency as TransactionCurrency,
              toCurrency as TransactionCurrency,
              this.rate,
            )
          : draft.type === 'transfer'
            ? draft.amount
            : null,
        exchangeRate: cross ? this.rate : null,
      });
      this.transactions = [created, ...this.transactions];

      return created;
    });
  }

  private currencyOf(id: number | null): string | null {
    return id === null ? null : (this.accounts?.accounts.find((item) => item.id === id)?.currency ?? 'COP');
  }
}

/** Arma un movimiento de prueba con valores por defecto razonables. */
export function transaction(
  id: number,
  type: Transaction['type'],
  amount: number,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    type,
    amount,
    date: '2026-11-02T17:00:00Z',
    fromAccountId: null,
    toAccountId: null,
    categoryId: null,
    description: null,
    fromCurrency: null,
    toCurrency: null,
    destinationAmount: null,
    exchangeRate: null,
    exchangeRateDate: null,
    ...overrides,
  };
}

/** Los cuatro puertos falsos del dominio, enlazados entre sí. */
export class TransactionFakes {
  readonly accounts = new FakeTransactionAccountOptionsRepository();
  readonly categories = new FakeTransactionCategoryOptionsRepository();
  readonly rates = new FakeExchangeRateRepository();
  readonly transactions = new FakeTransactionRepository(this.accounts);
  /** El cierre de períodos que usa la nota de fecha cerrada del formulario. */
  readonly periods = new FakePeriodRepository();
}

/** Las rutas reales del dominio montadas en `/transactions`, con los puertos falsos en lugar de los HTTP. */
export function fakeTransactionsRoutes(fakes = new TransactionFakes()): Routes {
  const [root] = transactionsRoutes;

  return [
    {
      path: 'transactions',
      children: [
        {
          ...root,
          providers: [
            ...(root.providers ?? []),
            { provide: TransactionRepository, useValue: fakes.transactions },
            { provide: TransactionAccountOptionsRepository, useValue: fakes.accounts },
            { provide: TransactionCategoryOptionsRepository, useValue: fakes.categories },
            { provide: ExchangeRateRepository, useValue: fakes.rates },
            ...provideFakePeriods(fakes.periods),
          ],
        },
      ],
    },
  ];
}
