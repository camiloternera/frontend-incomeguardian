import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { AccountError, AccountErrorCode } from '../domain/account-error';
import { AccountHttpRepository } from './account-http.repository';

const URL = `${environment.apiUrl}/api/v1/accounts`;

const DTO = {
  id: 5,
  name: 'Visa 4417',
  initialBalance: -250000.5,
  currentBalance: null,
  currency: 'COP',
  isActive: true,
  openingDate: '2026-01-15T14:30:00Z',
  createdAt: '2026-10-31T12:00:00+00:00',
  updatedAt: null,
};

/** Campos de tarjeta de una cuenta normal. */
const NO_CARD = { kind: 'standard' as const, creditLimit: null, statementDay: null, paymentDay: null };

function ok(data: unknown) {
  return { data, isSuccess: true, message: 'ok', errors: [] };
}

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

describe('AccountHttpRepository', () => {
  let repository: AccountHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), AccountHttpRepository],
    });
    repository = TestBed.inject(AccountHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps the envelope and maps the DTOs without the current balance', () => {
    let result: unknown;
    repository.list().subscribe((value) => (result = value));

    http.expectOne(URL).flush(ok([DTO]));

    expect(result).toEqual([
      {
        id: 5,
        name: 'Visa 4417',
        // Sin `kind` (backend anterior a las tarjetas) la cuenta es normal.
        kind: 'standard',
        initialBalance: -250000.5,
        currentBalance: -250000.5,
        currency: 'COP',
        isActive: true,
        // Sin el campo en la respuesta, la cuenta se toma como sin movimientos.
        hasTransactions: false,
        openingDate: '2026-01-15T14:30:00Z',
        creditLimit: null,
        statementDay: null,
        paymentDay: null,
        availableCredit: null,
        nextStatementDate: null,
        nextPaymentDueDate: null,
        createdAt: '2026-10-31T12:00:00+00:00',
        updatedAt: null,
      },
    ]);
  });

  it('maps whether the account has transactions', () => {
    let result: { hasTransactions: boolean }[] | undefined;
    repository.list().subscribe((value) => (result = value));

    http.expectOne(URL).flush(
      ok([
        { ...DTO, id: 5, hasTransactions: true },
        { ...DTO, id: 6, hasTransactions: false },
        { ...DTO, id: 7, hasTransactions: null },
      ]),
    );

    expect(result!.map((account) => account.hasTransactions)).toEqual([true, false, false]);
  });

  it('sends the draft with its currency on create and update', () => {
    const draft = {
      name: 'Wise',
      initialBalance: 320.5,
      currency: 'USD' as const,
      openingDate: '2026-01-15T09:30:00-05:00',
      ...NO_CARD,
    };
    // Una cuenta normal manda `kind` y ningún campo de tarjeta.
    const body = {
      name: 'Wise',
      kind: 'standard',
      initialBalance: 320.5,
      currency: 'USD',
      openingDate: '2026-01-15T09:30:00-05:00',
    };

    repository.create(draft).subscribe();
    const create = http.expectOne(URL);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(body);
    create.flush(ok({ ...DTO, currency: 'USD' }), { status: 201, statusText: 'Created' });

    repository.update(5, draft).subscribe();
    const update = http.expectOne(`${URL}/5`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(body);
    update.flush(ok(DTO));
  });

  it('deactivates with a DELETE', () => {
    let done = false;
    repository.deactivate(5).subscribe(() => (done = true));

    const request = http.expectOne(`${URL}/5`);
    expect(request.request.method).toBe('DELETE');
    request.flush(ok(true));

    expect(done).toBe(true);
  });

  it('keeps the backend code and translates it', () => {
    let error: unknown;
    repository.update(5, { name: 'Wise', initialBalance: 0, currency: 'EUR', openingDate: '2026-01-15T09:30:00-05:00', ...NO_CARD }).subscribe({
      error: (value) => (error = value),
    });

    http.expectOne(`${URL}/5`).flush(failure(AccountErrorCode.CurrencyLocked), { status: 409, statusText: 'Conflict' });

    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).code).toBe(AccountErrorCode.CurrencyLocked);
    expect((error as AccountError).message).toBe('The account already has transactions, so its currency cannot change.');
  });

  it('keeps the locked name code and translates it', () => {
    let error: unknown;
    repository.update(5, { name: 'Visa nueva', initialBalance: 0, currency: 'COP', openingDate: '2026-01-15T09:30:00-05:00', ...NO_CARD }).subscribe({
      error: (value) => (error = value),
    });

    http.expectOne(`${URL}/5`).flush(failure(AccountErrorCode.NameLocked), { status: 409, statusText: 'Conflict' });

    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).code).toBe(AccountErrorCode.NameLocked);
    expect((error as AccountError).message).toBe('The account already has transactions, so its name cannot change.');
  });

  it('rejects a currency the app does not know', () => {
    let error: unknown;
    repository.get(5).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/5`).flush(ok({ ...DTO, currency: 'JPY' }));

    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).code).toBeNull();
  });
  it('maps a credit card with its limit, days and calendar dates as days', () => {
    let result: unknown;
    repository.get(5).subscribe((value) => (result = value));

    http.expectOne(`${URL}/5`).flush(
      ok({
        ...DTO,
        kind: 'credit_card',
        currentBalance: -300000,
        creditLimit: 2000000,
        statementDay: 15,
        paymentDay: 5,
        availableCredit: 1700000,
        nextStatementDate: '2026-11-15',
        // Un instante se lleva al día en hora de Colombia.
        nextPaymentDueDate: '2026-12-05T04:00:00Z',
      }),
    );

    expect(result).toMatchObject({
      kind: 'credit_card',
      currentBalance: -300000,
      creditLimit: 2000000,
      statementDay: 15,
      paymentDay: 5,
      availableCredit: 1700000,
      nextStatementDate: '2026-11-15',
      nextPaymentDueDate: '2026-12-04',
    });
  });

  it('rejects a kind the app does not know', () => {
    let error: unknown;
    repository.get(5).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/5`).flush(ok({ ...DTO, kind: 'loan' }));

    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).code).toBeNull();
  });

  it('sends the card fields only for a credit card, and the limit only when set', () => {
    const card = {
      name: 'Visa',
      kind: 'credit_card' as const,
      initialBalance: -150000,
      currency: 'COP' as const,
      openingDate: '2026-01-15T09:30:00-05:00',
      creditLimit: 2000000,
      statementDay: 15,
      paymentDay: 5,
    };

    repository.create(card).subscribe();
    expect(http.expectOne(URL).request.body).toEqual({
      name: 'Visa',
      kind: 'credit_card',
      initialBalance: -150000,
      currency: 'COP',
      openingDate: '2026-01-15T09:30:00-05:00',
      creditLimit: 2000000,
      statementDay: 15,
      paymentDay: 5,
    });

    repository.create({ ...card, creditLimit: null }).subscribe();
    expect(http.expectOne(URL).request.body).not.toHaveProperty('creditLimit');

    // Si el borrador cambia a cuenta normal, los días que traiga no se envían.
    repository.update(5, { ...card, kind: 'standard' }).subscribe();
    const body = http.expectOne(`${URL}/5`).request.body;
    expect(body.kind).toBe('standard');
    expect(body).not.toHaveProperty('creditLimit');
    expect(body).not.toHaveProperty('statementDay');
    expect(body).not.toHaveProperty('paymentDay');
  });

  it.each([
    AccountErrorCode.CardInitialBalancePositive,
    AccountErrorCode.StatementDayRequired,
    AccountErrorCode.StatementDayInvalid,
    AccountErrorCode.PaymentDayRequired,
    AccountErrorCode.PaymentDayInvalid,
    AccountErrorCode.CreditLimitInvalid,
    AccountErrorCode.KindInvalid,
    AccountErrorCode.KindLocked,
    AccountErrorCode.NotCreditCard,
  ])('keeps the card code %s with its own copy', (code) => {
    let error: unknown;
    repository.get(5).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/5`).flush(failure(code), { status: 400, statusText: 'Bad Request' });

    expect((error as AccountError).code).toBe(code);
    expect((error as AccountError).message).not.toBe('Backend message');
    expect((error as AccountError).message).not.toContain('accounts.errors');
  });

  describe('statement', () => {
    const STATEMENT = {
      accountId: 5,
      year: 2026,
      month: 11,
      statementDay: 15,
      periodStart: '2026-10-16',
      periodEnd: '2026-11-15',
      paymentDueDate: '2026-12-05T04:00:00Z',
      total: 400000,
      paymentsTotal: 100000,
      balanceDue: 300000,
      status: 'partial',
      openingDebt: null,
      items: [
        {
          transactionId: 41,
          description: null,
          categoryName: 'Mercado',
          purchaseDate: '2026-10-20T15:00:00Z',
          number: 2,
          installments: 6,
          principal: 50000,
          interest: 1500,
          amount: 51500,
        },
      ],
      payments: null,
      previous: { year: 2026, month: 10 },
      next: null,
    };

    it('maps the kind of every item and treats an unknown or missing one as a purchase', () => {
      let result: { items: { transactionId: number; kind: string; categoryName: string | null }[] } | undefined;
      repository.statement(5).subscribe((value) => (result = value));

      const [item] = STATEMENT.items;
      http.expectOne((req) => req.url === `${URL}/5/statement`).flush(
        ok({
          ...STATEMENT,
          items: [
            { ...item, transactionId: 1, kind: 'purchase' },
            { ...item, transactionId: 2, kind: 'advance' },
            { ...item, transactionId: 3, kind: 'fee', description: null, categoryName: 'Comisiones bancarias' },
            { ...item, transactionId: 4, kind: 'refund' },
            { ...item, transactionId: 5, kind: null },
            { ...item, transactionId: 6 },
          ],
        }),
      );

      expect(result?.items.map((each) => [each.transactionId, each.kind])).toEqual([
        [1, 'purchase'],
        [2, 'advance'],
        [3, 'fee'],
        [4, 'purchase'],
        [5, 'purchase'],
        [6, 'purchase'],
      ]);
      expect(result?.items[2].categoryName).toBe('Comisiones bancarias');
    });

    it('asks for the next statement without a month', () => {
      repository.statement(5).subscribe();

      const request = http.expectOne((req) => req.url === `${URL}/5/statement`);
      expect(request.request.method).toBe('GET');
      expect(request.request.params.keys()).toEqual([]);
      request.flush(ok(STATEMENT));
    });

    it('asks for the given month and maps the statement', () => {
      let result: unknown;
      repository.statement(5, { year: 2026, month: 11 }).subscribe((value) => (result = value));

      const request = http.expectOne((req) => req.url === `${URL}/5/statement`);
      expect(request.request.params.get('year')).toBe('2026');
      expect(request.request.params.get('month')).toBe('11');
      request.flush(ok(STATEMENT));

      expect(result).toEqual({
        accountId: 5,
        month: { year: 2026, month: 11 },
        statementDay: 15,
        periodStart: '2026-10-16',
        periodEnd: '2026-11-15',
        paymentDueDate: '2026-12-04',
        total: 400000,
        paymentsTotal: 100000,
        balanceDue: 300000,
        status: 'partial',
        openingDebt: 0,
        items: [
          {
            transactionId: 41,
            kind: 'purchase',
            description: null,
            categoryName: 'Mercado',
            purchaseDate: '2026-10-20',
            number: 2,
            installments: 6,
            principal: 50000,
            interest: 1500,
            amount: 51500,
          },
        ],
        payments: [],
        previous: { year: 2026, month: 10 },
        next: null,
      });
    });

    it('maps an upcoming statement', () => {
      let status: string | undefined;
      repository.statement(5).subscribe((value) => (status = value.status));

      http.expectOne((req) => req.url === `${URL}/5/statement`).flush(ok({ ...STATEMENT, status: 'upcoming' }));

      expect(status).toBe('upcoming');
    });

    it('rejects a status the app does not know', () => {
      let error: unknown;
      repository.statement(5).subscribe({ error: (value) => (error = value) });

      http.expectOne((req) => req.url === `${URL}/5/statement`).flush(ok({ ...STATEMENT, status: 'frozen' }));

      expect(error).toBeInstanceOf(AccountError);
      expect((error as AccountError).code).toBeNull();
    });

    it('keeps ACCOUNT_NOT_CREDIT_CARD', () => {
      let error: unknown;
      repository.statement(2).subscribe({ error: (value) => (error = value) });

      http
        .expectOne((req) => req.url === `${URL}/2/statement`)
        .flush(failure(AccountErrorCode.NotCreditCard), { status: 400, statusText: 'Bad Request' });

      expect((error as AccountError).code).toBe(AccountErrorCode.NotCreditCard);
    });
  });
});
