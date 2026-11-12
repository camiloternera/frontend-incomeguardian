import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
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

/** Campos de cuotas de un movimiento de una sola cuota, y `canModify` cuando el backend no lo envía. */
const SINGLE = {
  installments: 1,
  annualInterestRate: null,
  installmentAmount: null,
  schedule: [],
  canModify: true,
  isCardAdvance: false,
  advanceFee: null,
  feeTransactionId: null,
  parentTransactionId: null,
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

  it('sends the date range as UTC instants when given', () => {
    repository
      .list({ page: 2, pageSize: 5, fromDate: '2026-11-01T05:00:00.000Z', toDate: '2026-12-01T04:59:59.999Z' })
      .subscribe();

    const request = http.expectOne((req) => req.url === URL);
    expect(request.request.params.get('fromDate')).toBe('2026-11-01T05:00:00.000Z');
    expect(request.request.params.get('toDate')).toBe('2026-12-01T04:59:59.999Z');
    request.flush(ok({ items: [], page: 2, pageSize: 5, totalItems: 0 }));
  });

  it('asks the summary of a range and keeps each currency apart', () => {
    let result: unknown;
    repository
      .summary({ fromDate: '2026-11-01T05:00:00.000Z', toDate: '2026-12-01T04:59:59.999Z' })
      .subscribe((value) => (result = value));

    const request = http.expectOne((req) => req.url === `${URL}/summary`);
    expect(request.request.params.get('fromDate')).toBe('2026-11-01T05:00:00.000Z');
    expect(request.request.params.get('toDate')).toBe('2026-12-01T04:59:59.999Z');
    const cop = { currency: 'COP', income: 3200000, expense: 1146300, transfersIn: 0, transfersOut: 400000, net: 1653700 };
    const usd = { currency: 'USD', income: 0, expense: 0, transfersIn: 101.27, transfersOut: 0, net: 101.27 };
    request.flush(ok({ totalItems: 14, currencies: [cop, usd] }));

    expect(result).toEqual({ totalItems: 14, currencies: [cop, usd] });
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
          // Sin los campos de cuotas, es una sola cuota sin plan.
          installments: 1,
          annualInterestRate: null,
          installmentAmount: null,
          schedule: [],
          // Sin el campo, no se bloquea nada: el backend sigue validando el mes cerrado.
          canModify: true,
          // Sin los campos de avances, no es avance ni comisión.
          isCardAdvance: false,
          advanceFee: null,
          feeTransactionId: null,
          parentTransactionId: null,
        },
        { ...TRANSFER_DTO, ...SINGLE },
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

    expect(result).toEqual({ ...TRANSFER_DTO, ...SINGLE });
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
  describe('edit and delete', () => {
    const INCOME = {
      type: 'income' as const,
      amount: 1500000,
      date: '2026-11-01T15:00:00.000Z',
      toAccountId: 3,
      categoryId: 1,
      description: 'Salario',
    };

    it('maps canModify when the backend sends it', () => {
      let result: { items: { canModify: boolean }[] } | undefined;
      repository.list({ page: 1, pageSize: 5 }).subscribe((value) => (result = value));

      http.expectOne((req) => req.url === URL).flush(
        ok({
          items: [
            { ...LEGACY_DTO, id: 1, canModify: false },
            { ...LEGACY_DTO, id: 2, canModify: true },
            { ...LEGACY_DTO, id: 3, canModify: null },
          ],
          page: 1,
          pageSize: 5,
          totalItems: 3,
        }),
      );

      expect(result?.items.map((item) => item.canModify)).toEqual([false, true, true]);
    });

    it('keeps canModify when getting one transaction', () => {
      let result: { canModify: boolean } | undefined;
      repository.get(9).subscribe((value) => (result = value));

      http.expectOne(`${URL}/9`).flush(ok({ ...LEGACY_DTO, canModify: false }));

      expect(result?.canModify).toBe(false);
    });

    it('updates with a PUT to the id and the same body as creating', () => {
      let created: unknown;
      repository.create(INCOME).subscribe();
      const post = http.expectOne(URL);
      created = post.request.body;
      post.flush(ok({ ...LEGACY_DTO, type: 'income', fromAccountId: null, toAccountId: 3 }), { status: 201, statusText: 'Created' });

      let result: unknown;
      repository.update(9, INCOME).subscribe((value) => (result = value));

      const request = http.expectOne(`${URL}/9`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual(created);
      request.flush(ok({ ...LEGACY_DTO, type: 'income', fromAccountId: null, toAccountId: 3, description: 'Salario', canModify: true }));

      expect(result).toMatchObject({ id: 9, type: 'income', toAccountId: 3, description: 'Salario', canModify: true });
    });

    it('sends the installments of a card purchase when updating', () => {
      repository
        .update(9, { type: 'expense', amount: 30000, date: '2026-11-01T15:00:00.000Z', fromAccountId: 9, categoryId: null, description: null, installments: 3, annualInterestRate: 24.5 })
        .subscribe();

      const request = http.expectOne(`${URL}/9`);
      expect(request.request.body).toMatchObject({ installments: 3, annualInterestRate: 24.5 });
      request.flush(ok(LEGACY_DTO));
    });

    it('keeps the closed month when an update hits PERIOD_CLOSED', () => {
      const error = captureError((handlers) => repository.update(9, INCOME).subscribe(handlers));

      http.expectOne(`${URL}/9`).flush(
        {
          data: null,
          isSuccess: false,
          message: '',
          errors: [{ code: TransactionErrorCode.PeriodClosed, message: 'Closed', data: { year: 2026, month: 10 } }],
        },
        { status: 409, statusText: 'Conflict' },
      );

      expect(error()).toBeInstanceOf(TransactionError);
      expect((error() as TransactionError).code).toBe(TransactionErrorCode.PeriodClosed);
      expect((error() as TransactionError).closedMonth).toEqual({ year: 2026, month: 10 });
    });

    it.each([TransactionErrorCode.AccountInactive, TransactionErrorCode.CategoryNotFound, TransactionErrorCode.NotFound])(
      'keeps %s when updating',
      (code) => {
        const error = captureError((handlers) => repository.update(9, INCOME).subscribe(handlers));

        http.expectOne(`${URL}/9`).flush(failure(code), { status: 400, statusText: 'Bad Request' });

        expect((error() as TransactionError).code).toBe(code);
        expect((error() as TransactionError).message).not.toContain('transactions.errors');
      },
    );

    it('deletes with a DELETE to the id and completes without a value', () => {
      const values: unknown[] = [];
      let completed = false;
      repository.remove(9).subscribe({ next: (value) => values.push(value), complete: () => (completed = true) });

      const request = http.expectOne(`${URL}/9`);
      expect(request.request.method).toBe('DELETE');
      request.flush(ok(true));

      expect(values).toEqual([undefined]);
      expect(completed).toBe(true);
    });

    it('keeps the closed month when a delete hits PERIOD_CLOSED', () => {
      const error = captureError((handlers) => repository.remove(9).subscribe(handlers));

      http.expectOne(`${URL}/9`).flush(
        {
          data: null,
          isSuccess: false,
          message: '',
          errors: [{ code: TransactionErrorCode.PeriodClosed, message: 'Closed', data: { year: 2026, month: 10 } }],
        },
        { status: 409, statusText: 'Conflict' },
      );

      expect((error() as TransactionError).code).toBe(TransactionErrorCode.PeriodClosed);
      expect((error() as TransactionError).closedMonth).toEqual({ year: 2026, month: 10 });
      expect((error() as TransactionError).message).not.toContain('transactions.errors');
    });

    it('keeps TRANSACTION_NOT_FOUND when deleting', () => {
      const error = captureError((handlers) => repository.remove(9).subscribe(handlers));

      http.expectOne(`${URL}/9`).flush(failure(TransactionErrorCode.NotFound), { status: 404, statusText: 'Not Found' });

      expect((error() as TransactionError).code).toBe(TransactionErrorCode.NotFound);
    });

    it('rejects a 2xx delete whose envelope reports a failure', () => {
      const error = captureError((handlers) => repository.remove(9).subscribe(handlers));

      http.expectOne(`${URL}/9`).flush(failure(TransactionErrorCode.NotFound));

      expect(error()).toBeInstanceOf(TransactionError);
      expect((error() as TransactionError).code).toBe(TransactionErrorCode.NotFound);
    });
  });

  describe('card advances', () => {
    const ADVANCE = {
      type: 'transfer' as const,
      amount: 600000,
      date: '2026-11-01T15:00:00.000Z',
      fromAccountId: 20,
      toAccountId: 2,
      categoryId: 6,
      description: null,
    };

    function body(): Record<string, unknown> {
      const request = http.expectOne(URL);
      const sent = request.request.body as Record<string, unknown>;
      request.flush(ok(TRANSFER_DTO), { status: 201, statusText: 'Created' });

      return sent;
    }

    it('maps an advance with its fee', () => {
      let result: unknown;
      repository.get(10).subscribe((value) => (result = value));

      http
        .expectOne(`${URL}/10`)
        .flush(ok({ ...TRANSFER_DTO, isCardAdvance: true, advanceFee: 15000, feeTransactionId: 11, parentTransactionId: null }));

      expect(result).toMatchObject({ id: 10, isCardAdvance: true, advanceFee: 15000, feeTransactionId: 11, parentTransactionId: null });
    });

    it('maps the fee of an advance with its parent', () => {
      let result: unknown;
      repository.get(11).subscribe((value) => (result = value));

      http.expectOne(`${URL}/11`).flush(ok({ ...LEGACY_DTO, id: 11, parentTransactionId: 10, canModify: false }));

      expect(result).toMatchObject({ id: 11, isCardAdvance: false, advanceFee: null, parentTransactionId: 10, canModify: false });
    });

    it('defaults the advance fields when the backend does not send them or sends null', () => {
      let result: { items: unknown[] } | undefined;
      repository.list({ page: 1, pageSize: 5 }).subscribe((value) => (result = value));

      http.expectOne((req) => req.url === URL).flush(
        ok({
          items: [
            LEGACY_DTO,
            { ...LEGACY_DTO, id: 2, isCardAdvance: null, advanceFee: null, feeTransactionId: null, parentTransactionId: null },
          ],
          page: 1,
          pageSize: 5,
          totalItems: 2,
        }),
      );

      const defaults = { isCardAdvance: false, advanceFee: null, feeTransactionId: null, parentTransactionId: null };
      expect(result?.items).toEqual([expect.objectContaining(defaults), expect.objectContaining(defaults)]);
    });

    it('sends the installments, the rate and the fee of an advance', () => {
      repository.create({ ...ADVANCE, installments: 6, annualInterestRate: 24.5, advanceFee: 15000 }).subscribe();

      expect(body()).toEqual({
        type: 'transfer',
        amount: 600000,
        date: ADVANCE.date,
        fromAccountId: 20,
        toAccountId: 2,
        categoryId: 6,
        installments: 6,
        annualInterestRate: 24.5,
        advanceFee: 15000,
      });
    });

    it('sends the fee of a one-installment advance without installments', () => {
      repository.create({ ...ADVANCE, installments: 1, annualInterestRate: 24.5, advanceFee: 15000 }).subscribe();

      const sent = body();
      expect(sent['advanceFee']).toBe(15000);
      expect('installments' in sent).toBe(false);
      expect('annualInterestRate' in sent).toBe(false);
    });

    it('omits the rate of an advance without interest', () => {
      repository.create({ ...ADVANCE, installments: 3, annualInterestRate: null, advanceFee: null }).subscribe();

      const sent = body();
      expect(sent['installments']).toBe(3);
      expect('annualInterestRate' in sent).toBe(false);
      expect('advanceFee' in sent).toBe(false);
    });

    it('sends a plain transfer without installments nor fee', () => {
      repository.create({ ...ADVANCE, installments: 1, annualInterestRate: null, advanceFee: null }).subscribe();

      expect(body()).toEqual({ type: 'transfer', amount: 600000, date: ADVANCE.date, fromAccountId: 20, toAccountId: 2, categoryId: 6 });
    });

    it('drops the fee on update by leaving it out', () => {
      repository.update(10, { ...ADVANCE, installments: 6, annualInterestRate: 0, advanceFee: null }).subscribe();

      const request = http.expectOne(`${URL}/10`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({
        type: 'transfer',
        amount: 600000,
        date: ADVANCE.date,
        fromAccountId: 20,
        toAccountId: 2,
        categoryId: 6,
        installments: 6,
        annualInterestRate: 0,
      });
      request.flush(ok(TRANSFER_DTO));
    });

    it.each([
      [TransactionErrorCode.AdvanceFeeNotAllowed, 'A fee only applies to cash advances: from a credit card to a regular account.'],
      [TransactionErrorCode.AdvanceFeeInvalid, 'The fee must be greater than zero with up to 2 decimals.'],
    ])('keeps %s with its message', (code, message) => {
      const error = captureError((handlers) => repository.create({ ...ADVANCE, advanceFee: -1 }).subscribe(handlers));

      http.expectOne(URL).flush(failure(code), { status: 400, statusText: 'Bad Request' });

      expect((error() as TransactionError).code).toBe(code);
      expect((error() as TransactionError).message).toBe(message);
    });

    it('keeps the managed by parent code when deleting a fee', () => {
      const error = captureError((handlers) => repository.remove(11).subscribe(handlers));

      http.expectOne(`${URL}/11`).flush(failure(TransactionErrorCode.ManagedByParent), { status: 409, statusText: 'Conflict' });

      expect((error() as TransactionError).code).toBe(TransactionErrorCode.ManagedByParent);
      expect((error() as TransactionError).message).toBe(
        'This fee belongs to a cash advance: change or delete it from the advance.',
      );
    });

    it('translates the managed by parent message into Spanish', () => {
      TestBed.inject(TranslocoService).setActiveLang('es-CO');
      const error = captureError((handlers) => repository.update(11, { ...ADVANCE }).subscribe(handlers));

      http.expectOne(`${URL}/11`).flush(failure(TransactionErrorCode.ManagedByParent), { status: 409, statusText: 'Conflict' });

      expect((error() as TransactionError).message).toBe(
        'Esta comisión pertenece a un avance: cámbiala o elimínala desde el avance.',
      );
    });
  });

  describe('installments', () => {
    const SCHEDULE_DTO = [
      { number: 1, year: 2026, month: 11, statementDate: '2026-11-15', principal: 15000, interest: 0, amount: 15000 },
      // Un instante se lleva al día en hora de Colombia.
      { number: 2, year: 2026, month: 12, statementDate: '2026-12-15T05:00:00Z', principal: 15000, interest: 0, amount: 15000 },
    ];
    const SCHEDULE = [
      { number: 1, year: 2026, month: 11, statementDate: '2026-11-15', principal: 15000, interest: 0, amount: 15000 },
      { number: 2, year: 2026, month: 12, statementDate: '2026-12-15', principal: 15000, interest: 0, amount: 15000 },
    ];
    const EXPENSE = {
      type: 'expense' as const,
      amount: 30000,
      date: '2026-11-01T15:00:00.000Z',
      fromAccountId: 9,
      categoryId: null,
      description: null,
    };

    it('gets one transaction with its plan', () => {
      let result: unknown;
      repository.get(9).subscribe((value) => (result = value));

      const request = http.expectOne(`${URL}/9`);
      expect(request.request.method).toBe('GET');
      request.flush(
        ok({ ...LEGACY_DTO, installments: 2, annualInterestRate: 24.5, installmentAmount: 15000, schedule: SCHEDULE_DTO }),
      );

      expect(result).toMatchObject({ id: 9, installments: 2, annualInterestRate: 24.5, installmentAmount: 15000, schedule: SCHEDULE });
    });

    it('previews the plan and omits the rate and the category when null', () => {
      let result: unknown;
      repository
        .previewInstallments({
          fromAccountId: 9,
          amount: 30000,
          date: '2026-11-01T15:00:00.000Z',
          installments: 2,
          annualInterestRate: null,
          categoryId: null,
        })
        .subscribe((value) => (result = value));

      const request = http.expectOne(`${URL}/installments/preview`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ fromAccountId: 9, amount: 30000, date: '2026-11-01T15:00:00.000Z', installments: 2 });
      request.flush(
        ok({
          installmentAmount: 15000,
          totalInterest: 0,
          totalAmount: 30000,
          schedule: SCHEDULE_DTO,
          budgetAdjustments: [{ year: 2026, month: 12, categoryId: 4, currency: 'COP', newAmount: 15000 }],
        }),
      );

      expect(result).toEqual({
        installmentAmount: 15000,
        totalInterest: 0,
        totalAmount: 30000,
        schedule: SCHEDULE,
        budgetAdjustments: [{ year: 2026, month: 12, categoryId: 4, currency: 'COP', currentAmount: null, newAmount: 15000 }],
      });
    });

    it('sends the rate and the category of the preview when set', () => {
      repository
        .previewInstallments({
          fromAccountId: 9,
          amount: 30000,
          date: '2026-11-01T15:00:00.000Z',
          installments: 3,
          annualInterestRate: 0,
          categoryId: 4,
        })
        .subscribe();

      const request = http.expectOne(`${URL}/installments/preview`);
      // Una tasa de 0 es un valor, no la ausencia de interés.
      expect(request.request.body).toMatchObject({ annualInterestRate: 0, categoryId: 4 });
      request.flush(ok({ installmentAmount: 10000, totalInterest: 0, totalAmount: 30000, schedule: [] }));
    });

    it('sends the installments and the rate only with more than one installment', () => {
      repository.create({ ...EXPENSE, installments: 3, annualInterestRate: 24.5 }).subscribe();
      expect(http.expectOne(URL).request.body).toMatchObject({ installments: 3, annualInterestRate: 24.5 });

      repository.create({ ...EXPENSE, installments: 3, annualInterestRate: null }).subscribe();
      const withoutRate = http.expectOne(URL).request.body;
      expect(withoutRate.installments).toBe(3);
      expect(withoutRate).not.toHaveProperty('annualInterestRate');

      repository.create({ ...EXPENSE, installments: 1, annualInterestRate: 24.5 }).subscribe();
      const single = http.expectOne(URL).request.body;
      expect(single).not.toHaveProperty('installments');
      expect(single).not.toHaveProperty('annualInterestRate');
    });

    it('keeps the closed month that PERIOD_CLOSED sends', () => {
      const error = captureError((handlers) => repository.create({ ...EXPENSE, installments: 3 }).subscribe(handlers));

      http.expectOne(URL).flush(
        {
          data: null,
          isSuccess: false,
          message: '',
          errors: [{ code: TransactionErrorCode.PeriodClosed, message: 'Closed', data: { year: 2026, month: 12 } }],
        },
        { status: 409, statusText: 'Conflict' },
      );

      expect((error() as TransactionError).code).toBe(TransactionErrorCode.PeriodClosed);
      expect((error() as TransactionError).closedMonth).toEqual({ year: 2026, month: 12 });
    });

    it('leaves the closed month null when the error brings no month', () => {
      const error = captureError((handlers) => repository.create(EXPENSE).subscribe(handlers));

      http.expectOne(URL).flush(failure(TransactionErrorCode.PeriodClosed), { status: 409, statusText: 'Conflict' });

      expect((error() as TransactionError).closedMonth).toBeNull();
    });

    it.each([
      TransactionErrorCode.InstallmentsNotAllowed,
      TransactionErrorCode.InstallmentsOutOfRange,
      TransactionErrorCode.InterestRateOutOfRange,
    ])('translates %s', (code) => {
      const error = captureError((handlers) => repository.get(9).subscribe(handlers));

      http.expectOne(`${URL}/9`).flush(failure(code), { status: 400, statusText: 'Bad Request' });

      expect((error() as TransactionError).code).toBe(code);
      expect((error() as TransactionError).message).not.toBe('Backend message');
      expect((error() as TransactionError).message).not.toContain('transactions.errors');
    });
  });
});

const NOT_A_CARD = { isCreditCard: false, availableCredit: null, nextStatementDate: null };

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

    const base = { createdAt: 'x', updatedAt: null };
    http.expectOne(ACCOUNTS_URL).flush(
      ok([
        { ...base, id: 1, name: 'Nequi', currency: 'COP', initialBalance: 1000, currentBalance: 2500, isActive: true },
        { ...base, id: 2, name: 'Wise', currency: 'USD', initialBalance: 320.5, currentBalance: null, isActive: true },
        { ...base, id: 3, name: 'Revolut', currency: 'EUR', initialBalance: 10, currentBalance: null, isActive: false },
      ]),
    );

    expect(result).toEqual([
      { id: 1, name: 'Nequi', currency: 'COP', currentBalance: 2500, isActive: true, ...NOT_A_CARD },
      { id: 2, name: 'Wise', currency: 'USD', currentBalance: 320.5, isActive: true, ...NOT_A_CARD },
      { id: 3, name: 'Revolut', currency: 'EUR', currentBalance: 10, isActive: false, ...NOT_A_CARD },
    ]);
  });

  it('maps a credit card with its available credit and next statement day', () => {
    let result: unknown;
    options.list().subscribe((value) => (result = value));

    http.expectOne(ACCOUNTS_URL).flush(
      ok([
        {
          id: 9,
          name: 'Visa',
          currency: 'COP',
          initialBalance: 0,
          currentBalance: -300000,
          isActive: true,
          kind: 'credit_card',
          availableCredit: 1700000,
          nextStatementDate: '2026-11-15T05:00:00Z',
        },
        { id: 1, name: 'Nequi', currency: 'COP', initialBalance: 0, currentBalance: 0, isActive: true, kind: 'standard' },
      ]),
    );

    expect(result).toEqual([
      {
        id: 9,
        name: 'Visa',
        currency: 'COP',
        currentBalance: -300000,
        isActive: true,
        isCreditCard: true,
        availableCredit: 1700000,
        nextStatementDate: '2026-11-15',
      },
      { id: 1, name: 'Nequi', currency: 'COP', currentBalance: 0, isActive: true, ...NOT_A_CARD },
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
      { id: 1, name: 'Salario', type: 'income', isActive: true, code: null },
      { id: 2, name: 'Viejo', type: 'expense', isActive: false, code: null },
      { id: 3, name: 'Ahorro', type: 'transfer', isActive: true, code: null },
      { id: 4, name: 'Rara', type: null, isActive: true, code: null },
    ]);
  });

  it('keeps the code of a system category', () => {
    let result: { code: string | null }[] | undefined;
    options.list('transfer').subscribe((value) => (result = value));

    http
      .expectOne((req) => req.url === CATEGORIES_URL)
      .flush(ok([{ ...base, id: 7, name: 'CARD_PAYMENT', isActive: true, transactionTypeId: 3, code: 'CARD_PAYMENT' }]));

    expect(result?.[0].code).toBe('CARD_PAYMENT');
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
