import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { TransactionError, TransactionErrorCode } from '../domain/transaction-error';
import {
  ExchangeRateHttpRepository,
  TransactionAccountOptionsHttpRepository,
  TransactionCategoryOptionsHttpRepository,
  TransactionHttpRepository,
} from './transaction-http.repository';

const URL = `${environment.apiUrl}/api/v1/transactions`;
const ACCOUNTS_URL = `${environment.apiUrl}/api/v1/accounts`;
const CATEGORIES_URL = `${environment.apiUrl}/api/v1/categories`;
const TRM_URL = `${environment.apiUrl}/api/v1/exchange-rates/trm`;
const GENERIC = 'Something went wrong. Please try again.';

/** Respuesta del backend actual, sin los campos de multimoneda. */
const LEGACY_DTO = {
  id: 9,
  type: 'expense',
  amount: 45000,
  date: '2026-11-01T15:00:00Z',
  fromAccountId: 2,
  toAccountId: null,
  categoryId: 4,
  description: 'Mercado',
};

const TRANSFER_DTO = {
  id: 10,
  type: 'transfer',
  amount: 400000,
  date: '2026-11-01T15:00:00Z',
  fromAccountId: 2,
  toAccountId: 3,
  categoryId: null,
  description: null,
  fromCurrency: 'COP',
  toCurrency: 'USD',
  destinationAmount: 101.27,
  exchangeRate: 3950,
  exchangeRateDate: '2026-11-01',
};

function ok(data: unknown) {
  return { data, isSuccess: true, message: 'ok', errors: [] };
}

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

function captureError(subscribe: (handlers: { error: (value: unknown) => void }) => void): () => unknown {
  let error: unknown;
  subscribe({ error: (value) => (error = value) });
  return () => error;
}

describe('TransactionHttpRepository', () => {
  let repository: TransactionHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), TransactionHttpRepository],
    });
    repository = TestBed.inject(TransactionHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends only the params that are set when listing', () => {
    repository.list({ page: 1, pageSize: 5 }).subscribe();

    const request = http.expectOne((req) => req.url === URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual(['page', 'pageSize']);
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('5');
    request.flush(ok({ items: [], page: 1, pageSize: 5, totalItems: 0 }));
  });

  it('sends the type and account filters when given', () => {
    repository.list({ page: 2, pageSize: 5, type: 'income', accountId: 7 }).subscribe();

    const request = http.expectOne((req) => req.url === URL);
    expect(request.request.params.get('type')).toBe('income');
    expect(request.request.params.get('accountId')).toBe('7');
    request.flush(ok({ items: [], page: 2, pageSize: 5, totalItems: 0 }));
  });

  it('maps the page and fills the missing currency fields with null', () => {
    let result: unknown;
    repository.list({ page: 1, pageSize: 5 }).subscribe((value) => (result = value));

    http.expectOne((req) => req.url === URL).flush(ok({ items: [LEGACY_DTO, TRANSFER_DTO], page: 1, pageSize: 5, totalItems: 2 }));

    expect(result).toEqual({
      items: [
        {
          ...LEGACY_DTO,
          type: 'expense',
          fromCurrency: null,
          toCurrency: null,
          destinationAmount: null,
          exchangeRate: null,
          exchangeRateDate: null,
        },
        TRANSFER_DTO,
      ],
      page: 1,
      pageSize: 5,
      totalItems: 2,
    });
  });

  it('rejects a transaction type the app does not know', () => {
    const error = captureError((handlers) => repository.list({ page: 1, pageSize: 5 }).subscribe(handlers));

    http
      .expectOne((req) => req.url === URL)
      .flush(ok({ items: [{ ...LEGACY_DTO, type: 'refund' }], page: 1, pageSize: 5, totalItems: 1 }));

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBeNull();
    expect((error() as TransactionError).message).toBe(GENERIC);
  });

  it('sends only the destination account for an income', () => {
    repository
      .create({ type: 'income', amount: 1500000, date: '2026-11-01T15:00:00.000Z', toAccountId: 3, categoryId: 1, description: 'Salario' })
      .subscribe();

    const request = http.expectOne(URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      type: 'income',
      amount: 1500000,
      date: '2026-11-01T15:00:00.000Z',
      toAccountId: 3,
      categoryId: 1,
      description: 'Salario',
    });
    request.flush(ok({ ...LEGACY_DTO, type: 'income', fromAccountId: null, toAccountId: 3 }), { status: 201, statusText: 'Created' });
  });

  it('sends only the source account for an expense and omits empty fields', () => {
    repository
      .create({ type: 'expense', amount: 45000, date: '2026-11-01T15:00:00.000Z', fromAccountId: 2, categoryId: null, description: null })
      .subscribe();

    const request = http.expectOne(URL);
    expect(request.request.body).toEqual({ type: 'expense', amount: 45000, date: '2026-11-01T15:00:00.000Z', fromAccountId: 2 });
    request.flush(ok(LEGACY_DTO), { status: 201, statusText: 'Created' });
  });

  it('sends both accounts for a transfer and never the destination amount', () => {
    let result: unknown;
    repository
      .create({
        type: 'transfer',
        amount: 400000,
        date: '2026-11-01T15:00:00.000Z',
        fromAccountId: 2,
        toAccountId: 3,
        categoryId: null,
        description: null,
      })
      .subscribe((value) => (result = value));

    const request = http.expectOne(URL);
    expect(request.request.body).toEqual({
      type: 'transfer',
      amount: 400000,
      date: '2026-11-01T15:00:00.000Z',
      fromAccountId: 2,
      toAccountId: 3,
    });
    expect('destinationAmount' in request.request.body).toBe(false);
    request.flush(ok(TRANSFER_DTO), { status: 201, statusText: 'Created' });

    expect(result).toEqual(TRANSFER_DTO);
  });

  it('keeps a known backend code', () => {
    const error = captureError((handlers) =>
      repository
        .create({ type: 'expense', amount: 1, date: '2026-11-01T15:00:00.000Z', fromAccountId: 2, categoryId: null, description: null })
        .subscribe(handlers),
    );

    http.expectOne(URL).flush(failure(TransactionErrorCode.AccountInactive), { status: 409, statusText: 'Conflict' });

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBe(TransactionErrorCode.AccountInactive);
  });

  it('keeps the unsupported currency code of an EUR account', () => {
    const error = captureError((handlers) =>
      repository
        .create({ type: 'income', amount: 1, date: '2026-11-01T15:00:00.000Z', toAccountId: 8, categoryId: null, description: null })
        .subscribe(handlers),
    );

    http
      .expectOne(URL)
      .flush(failure(TransactionErrorCode.AccountCurrencyUnsupported), { status: 400, statusText: 'Bad Request' });

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBe(TransactionErrorCode.AccountCurrencyUnsupported);
  });

  it('maps an unavailable exchange rate on create', () => {
    const error = captureError((handlers) =>
      repository
        .create({
          type: 'transfer',
          amount: 400000,
          date: '2026-11-01T15:00:00.000Z',
          fromAccountId: 2,
          toAccountId: 3,
          categoryId: null,
          description: null,
        })
        .subscribe(handlers),
    );

    http
      .expectOne(URL)
      .flush(failure(TransactionErrorCode.ExchangeRateUnavailable), { status: 503, statusText: 'Service Unavailable' });

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBe(TransactionErrorCode.ExchangeRateUnavailable);
  });

  it('gives a null code and the backend message for an unknown code', () => {
    const error = captureError((handlers) => repository.list({ page: 1, pageSize: 5 }).subscribe(handlers));

    http
      .expectOne((req) => req.url === URL)
      .flush(failure('SOMETHING_NEW', 'Mensaje del backend'), { status: 400, statusText: 'Bad Request' });

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBeNull();
    expect((error() as TransactionError).message).toBe('Mensaje del backend');
  });

  it('falls back to the generic copy when the failure has no envelope', () => {
    const error = captureError((handlers) => repository.list({ page: 1, pageSize: 5 }).subscribe(handlers));

    http.expectOne((req) => req.url === URL).error(new ProgressEvent('error'));

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBeNull();
    expect((error() as TransactionError).message).toBe(GENERIC);
  });
});

describe('TransactionAccountOptionsHttpRepository', () => {
  let options: TransactionAccountOptionsHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), TransactionAccountOptionsHttpRepository],
    });
    options = TestBed.inject(TransactionAccountOptionsHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps the accounts, falling back to the initial balance and keeping EUR accounts', () => {
    let result: unknown;
    options.list().subscribe((value) => (result = value));

    const base = { accountType: { id: 1, name: 'Ahorros' }, createdAt: 'x', updatedAt: null };
    http.expectOne(ACCOUNTS_URL).flush(
      ok([
        { ...base, id: 1, name: 'Nequi', currency: 'COP', initialBalance: 1000, currentBalance: 2500, isActive: true },
        { ...base, id: 2, name: 'Wise', currency: 'USD', initialBalance: 320.5, currentBalance: null, isActive: true },
        { ...base, id: 3, name: 'Revolut', currency: 'EUR', initialBalance: 10, currentBalance: null, isActive: false },
      ]),
    );

    expect(result).toEqual([
      { id: 1, name: 'Nequi', currency: 'COP', currentBalance: 2500, isActive: true },
      { id: 2, name: 'Wise', currency: 'USD', currentBalance: 320.5, isActive: true },
      { id: 3, name: 'Revolut', currency: 'EUR', currentBalance: 10, isActive: false },
    ]);
  });

  it('turns failures into a TransactionError', () => {
    const error = captureError((handlers) => options.list().subscribe(handlers));

    http.expectOne(ACCOUNTS_URL).flush(failure('UNAUTHORIZED'), { status: 401, statusText: 'Unauthorized' });

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBeNull();
  });
});

describe('TransactionCategoryOptionsHttpRepository', () => {
  let options: TransactionCategoryOptionsHttpRepository;
  let http: HttpTestingController;

  const base = { description: 'x', transactionTypeName: 'x', createdAt: 'x', updatedAt: null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), TransactionCategoryOptionsHttpRepository],
    });
    options = TestBed.inject(TransactionCategoryOptionsHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the transaction type id when given', () => {
    options.list('transfer').subscribe();

    const request = http.expectOne((req) => req.url === CATEGORIES_URL);
    expect(request.request.params.get('transactionTypeId')).toBe('3');
    request.flush(ok([]));
  });

  it('omits the filter when not given, keeps inactive ones and maps the type id', () => {
    let result: unknown;
    options.list().subscribe((value) => (result = value));

    const request = http.expectOne((req) => req.url === CATEGORIES_URL);
    expect(request.request.params.keys()).toEqual([]);
    request.flush(
      ok([
        { ...base, id: 1, name: 'Salario', isActive: true, transactionTypeId: 1 },
        { ...base, id: 2, name: 'Viejo', isActive: false, transactionTypeId: 2 },
        { ...base, id: 3, name: 'Ahorro', isActive: true, transactionTypeId: 3 },
        { ...base, id: 4, name: 'Rara', isActive: true, transactionTypeId: 9 },
      ]),
    );

    expect(result).toEqual([
      { id: 1, name: 'Salario', type: 'income', isActive: true },
      { id: 2, name: 'Viejo', type: 'expense', isActive: false },
      { id: 3, name: 'Ahorro', type: 'transfer', isActive: true },
      { id: 4, name: 'Rara', type: null, isActive: true },
    ]);
  });
});

describe('ExchangeRateHttpRepository', () => {
  let rates: ExchangeRateHttpRepository;
  let http: HttpTestingController;

  const RATE = { base: 'USD', quote: 'COP', rate: 3950.25, validFrom: '2026-11-01', validTo: '2026-11-03', source: 'Banco de la República' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), ExchangeRateHttpRepository],
    });
    rates = TestBed.inject(ExchangeRateHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the date when given and maps the rate', () => {
    let result: unknown;
    rates.trm('2026-11-01').subscribe((value) => (result = value));

    const request = http.expectOne((req) => req.url === TRM_URL);
    expect(request.request.params.get('date')).toBe('2026-11-01');
    request.flush(ok(RATE));

    expect(result).toEqual(RATE);
  });

  it('omits the date when not given', () => {
    rates.trm().subscribe();

    const request = http.expectOne((req) => req.url === TRM_URL);
    expect(request.request.params.keys()).toEqual([]);
    request.flush(ok(RATE));
  });

  it('maps a 503 to EXCHANGE_RATE_UNAVAILABLE', () => {
    const error = captureError((handlers) => rates.trm().subscribe(handlers));

    http
      .expectOne((req) => req.url === TRM_URL)
      .flush(failure(TransactionErrorCode.ExchangeRateUnavailable), { status: 503, statusText: 'Service Unavailable' });

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBe(TransactionErrorCode.ExchangeRateUnavailable);
  });

  it('rejects a currency pair the app does not know', () => {
    const error = captureError((handlers) => rates.trm().subscribe(handlers));

    http.expectOne((req) => req.url === TRM_URL).flush(ok({ ...RATE, base: 'EUR' }));

    expect(error()).toBeInstanceOf(TransactionError);
    expect((error() as TransactionError).code).toBeNull();
    expect((error() as TransactionError).message).toBe(GENERIC);
  });
});
