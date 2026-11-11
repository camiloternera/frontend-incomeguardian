import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { BudgetError, BudgetErrorCode } from '../domain/budget-error';
import { BudgetSummary } from '../domain/budget';
import {
  BudgetCategoryOptionsHttpRepository,
  BudgetHttpRepository,
  BudgetMovementsHttpRepository,
} from './budget-http.repository';

const URL = `${environment.apiUrl}/api/v1/budgets`;
const CATEGORIES_URL = `${environment.apiUrl}/api/v1/categories`;
const TRANSACTIONS_URL = `${environment.apiUrl}/api/v1/transactions`;
const ACCOUNTS_URL = `${environment.apiUrl}/api/v1/accounts`;
const NOVEMBER = { year: 2026, month: 11 };

const ROW_DTO = {
  categoryId: 1,
  categoryName: 'Alimentación',
  categoryTypeId: 2,
  currency: 'COP',
  budgetAmount: 850000,
  spentAmount: 30000,
  availableAmount: 820000,
  percentUsed: 3.5,
  recurringAmount: 800000,
  source: 'month',
};

function ok(data: unknown) {
  return { data, isSuccess: true, message: 'BUDGET_SAVED', errors: [] };
}

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

describe('BudgetHttpRepository', () => {
  let repository: BudgetHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), BudgetHttpRepository],
    });
    repository = TestBed.inject(BudgetHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks the summary of a month and maps rows and totals', () => {
    let result: unknown;
    repository.summary(NOVEMBER).subscribe((value) => (result = value));

    const request = http.expectOne((req) => req.url === `${URL}/summary`);
    expect(request.request.params.get('year')).toBe('2026');
    expect(request.request.params.get('month')).toBe('11');
    request.flush(
      ok({
        year: 2026,
        month: 11,
        isClosed: false,
        rows: [ROW_DTO, { ...ROW_DTO, categoryId: 9, categoryTypeId: 3, source: 'none', percentUsed: null, recurringAmount: null }],
        totals: [{ currency: 'COP', budget: 850000, spent: 30000, available: 820000 }],
      }),
    );

    expect(result).toEqual({
      year: 2026,
      month: 11,
      isClosed: false,
      rows: [
        {
          categoryId: 1,
          categoryName: 'Alimentación',
          categoryType: 'expense',
          currency: 'COP',
          budgetAmount: 850000,
          spentAmount: 30000,
          availableAmount: 820000,
          percentUsed: 3.5,
          recurringAmount: 800000,
          source: 'month',
          // Sin los campos de tarjetas (backend anterior) quedan neutros.
          monthAmount: null,
          installmentsRaise: 0,
          installmentsSpent: 0,
          installments: [],
        },
        expect.objectContaining({ categoryId: 9, categoryType: 'transfer', source: 'none', percentUsed: null }),
      ],
      totals: [{ currency: 'COP', budget: 850000, spent: 30000, available: 820000, installmentsSpent: 0 }],
    });
  });

  it('maps the installments that raise the limit and count this month', () => {
    let result: BudgetSummary | undefined;
    repository.summary(NOVEMBER).subscribe((value) => (result = value));

    http.expectOne((req) => req.url === `${URL}/summary`).flush(
      ok({
        year: 2026,
        month: 11,
        isClosed: false,
        rows: [
          {
            ...ROW_DTO,
            monthAmount: 900000,
            installmentsRaise: 100000,
            installmentsSpent: 150000,
            installments: [
              {
                transactionId: 41,
                description: null,
                number: 2,
                installments: 6,
                accountId: 9,
                accountName: 'Visa',
                // Un instante se lleva al día en hora de Colombia.
                purchaseDate: '2026-10-01T03:00:00Z',
                amount: 50000,
                budgetAdjustment: null,
              },
            ],
          },
        ],
        totals: [{ currency: 'COP', budget: 950000, spent: 180000, available: 770000, installmentsSpent: 150000 }],
      }),
    );

    expect(result?.rows[0]).toMatchObject({ monthAmount: 900000, installmentsRaise: 100000, installmentsSpent: 150000 });
    expect(result?.rows[0].installments).toEqual([
      {
        transactionId: 41,
        description: null,
        number: 2,
        installments: 6,
        accountId: 9,
        accountName: 'Visa',
        purchaseDate: '2026-09-30',
        amount: 50000,
        budgetAdjustment: 0,
      },
    ]);
    expect(result?.totals[0].installmentsSpent).toBe(150000);
  });

  it('rejects a source the app does not know', () => {
    let error: unknown;
    repository.summary(NOVEMBER).subscribe({ error: (value) => (error = value) });

    http
      .expectOne((req) => req.url === `${URL}/summary`)
      .flush(ok({ year: 2026, month: 11, isClosed: false, rows: [{ ...ROW_DTO, source: 'weekly' }], totals: [] }));

    expect(error).toBeInstanceOf(BudgetError);
    expect((error as BudgetError).code).toBeNull();
  });

  it('sets the recurring limit from a month on', () => {
    repository.saveRecurring({ categoryId: 1, currency: 'COP' }, 900000, NOVEMBER).subscribe();

    const request = http.expectOne(`${URL}/recurring`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ categoryId: 1, currency: 'COP', amount: 900000, fromYear: 2026, fromMonth: 11 });
    request.flush(ok({}));
  });

  it('removes the recurring limit from a month on', () => {
    let done = false;
    repository.removeRecurring({ categoryId: 1, currency: 'USD' }, NOVEMBER).subscribe(() => (done = true));

    const request = http.expectOne((req) => req.url === `${URL}/recurring/1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('currency')).toBe('USD');
    expect(request.request.params.get('fromYear')).toBe('2026');
    expect(request.request.params.get('fromMonth')).toBe('11');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBe(true);
  });

  it('saves and removes the limit of a single month', () => {
    repository.saveMonth(NOVEMBER, { categoryId: 6, currency: 'COP' }, 0).subscribe();
    const save = http.expectOne(`${URL}/2026/11`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ categoryId: 6, currency: 'COP', amount: 0 });
    save.flush(ok({}));

    repository.removeMonth(NOVEMBER, { categoryId: 6, currency: 'COP' }).subscribe();
    const remove = http.expectOne((req) => req.url === `${URL}/2026/11/6`);
    expect(remove.request.method).toBe('DELETE');
    expect(remove.request.params.get('currency')).toBe('COP');
    remove.flush(ok(null));
  });

  it('keeps a known backend code with its translated copy', () => {
    let error: unknown;
    repository
      .saveMonth(NOVEMBER, { categoryId: 6, currency: 'COP' }, 10)
      .subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/2026/11`).flush(failure(BudgetErrorCode.PeriodClosed), { status: 409, statusText: 'Conflict' });

    expect(error).toBeInstanceOf(BudgetError);
    expect((error as BudgetError).code).toBe(BudgetErrorCode.PeriodClosed);
    expect((error as BudgetError).message).toContain('This month is closed');
  });
});

describe('BudgetCategoryOptionsHttpRepository', () => {
  it('reads every category and keeps only expense and transfer types', () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), BudgetCategoryOptionsHttpRepository],
    });
    const http = TestBed.inject(HttpTestingController);
    let result: unknown;
    TestBed.inject(BudgetCategoryOptionsHttpRepository)
      .list()
      .subscribe((value) => (result = value));

    const request = http.expectOne((req) => req.url === CATEGORIES_URL);
    expect(request.request.params.get('status')).toBe('all');
    request.flush(
      ok([
        { id: 1, name: 'Mercado', isActive: true, transactionTypeId: 2 },
        { id: 2, name: 'Ahorro', isActive: false, transactionTypeId: 3 },
        { id: 3, name: 'Salario', isActive: true, transactionTypeId: 1 },
      ]),
    );

    expect(result).toEqual([
      { id: 1, name: 'Mercado', type: 'expense', isActive: true },
      { id: 2, name: 'Ahorro', type: 'transfer', isActive: false },
      { id: 3, name: 'Salario', type: null, isActive: true },
    ]);
    http.verify();
  });
});

describe('BudgetMovementsHttpRepository', () => {
  let http: HttpTestingController;
  let repository: BudgetMovementsHttpRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), BudgetMovementsHttpRepository],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(BudgetMovementsHttpRepository);
  });

  afterEach(() => http.verify());

  it('asks the month of the category and keeps only standard accounts in that currency', () => {
    let result: unknown;
    repository.list(NOVEMBER, { categoryId: 4, currency: 'COP' }, 'expense').subscribe((value) => (result = value));

    const transactions = http.expectOne((req) => req.url === TRANSACTIONS_URL);
    expect(transactions.request.params.get('categoryId')).toBe('4');
    expect(transactions.request.params.get('type')).toBe('expense');
    expect(transactions.request.params.get('fromDate')).toBe('2026-11-01T05:00:00.000Z');
    expect(transactions.request.params.get('toDate')).toBe('2026-12-01T04:59:59.999Z');
    expect(transactions.request.params.get('page')).toBe('1');
    transactions.flush(
      ok({
        items: [
          { id: 1, amount: 30000, date: '2026-11-03T15:00:00Z', fromAccountId: 2, description: 'Mercado' },
          { id: 2, amount: 90000, date: '2026-11-04T15:00:00Z', fromAccountId: 9, description: 'Con tarjeta' },
          { id: 3, amount: 20, date: '2026-11-05T15:00:00Z', fromAccountId: 8, description: 'En dólares' },
          { id: 4, amount: 5000, date: '2026-11-06T15:00:00Z', fromAccountId: null, description: null },
          { id: 5, amount: 7000, date: '2026-11-07T15:00:00Z', fromAccountId: 3, description: null },
        ],
      }),
    );
    http.expectOne(ACCOUNTS_URL).flush(
      ok([
        { id: 2, name: 'Bancolombia', currency: 'COP', kind: 'standard' },
        { id: 9, name: 'Visa', currency: 'COP', kind: 'credit_card' },
        { id: 8, name: 'Wise', currency: 'USD', kind: 'standard' },
        // Sin `kind` (backend anterior) la cuenta es normal.
        { id: 3, name: 'Nequi', currency: 'COP' },
      ]),
    );

    expect(result).toEqual([
      { transactionId: 1, description: 'Mercado', accountName: 'Bancolombia', date: '2026-11-03T15:00:00Z', amount: 30000 },
      { transactionId: 5, description: null, accountName: 'Nequi', date: '2026-11-07T15:00:00Z', amount: 7000 },
    ]);
  });

  it('translates a backend failure', () => {
    let error: unknown;
    repository.list(NOVEMBER, { categoryId: 4, currency: 'COP' }, 'expense').subscribe({ error: (value) => (error = value) });

    http.expectOne((req) => req.url === TRANSACTIONS_URL).flush(failure('SOMETHING_ELSE'), { status: 500, statusText: 'Error' });
    // forkJoin cancela la otra petición al fallar la primera.
    http.match(ACCOUNTS_URL);

    expect(error).toBeInstanceOf(BudgetError);
  });
});
