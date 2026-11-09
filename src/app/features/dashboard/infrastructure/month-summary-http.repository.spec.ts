import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { DashboardError, DashboardErrorCode } from '../domain/dashboard-error';
import { MonthSummaryHttpRepository } from './month-summary-http.repository';
import { MonthSummaryDto } from './month-summary.dto';

const URL = `${environment.apiUrl}/api/v1/dashboard/summary`;

function ok<T>(data: T) {
  return { data, isSuccess: true, message: 'ok', errors: [] };
}

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

describe('MonthSummaryHttpRepository', () => {
  let repository: MonthSummaryHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), MonthSummaryHttpRepository],
    });
    repository = TestBed.inject(MonthSummaryHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the year and month and maps each currency', () => {
    let result: unknown;
    repository.summary({ year: 2026, month: 11 }).subscribe((value) => (result = value));

    const request = http.expectOne((req) => req.url === URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('year')).toBe('2026');
    expect(request.request.params.get('month')).toBe('11');

    const history = [
      { year: 2026, month: 10, income: 5_900_000, spent: 3_600_000 },
      { year: 2026, month: 11, income: 6_200_000, spent: 2_360_000 },
    ];
    const categories = [
      { categoryId: 1, name: 'Vivienda', type: 'expense', spent: 1_150_000 },
      { categoryId: 6, name: 'Ahorro', type: 'transfer', spent: 120_000 },
    ];
    const dto: MonthSummaryDto = {
      year: 2026,
      month: 11,
      currencies: [
        { currency: 'COP', income: 6_200_000, incomePayments: 3, spent: 2_360_000, committed: 1_000_000, history, categories },
        {
          currency: 'USD',
          income: 1_200.5,
          incomePayments: 1,
          spent: 300,
          committed: 0,
          history: [{ year: 2026, month: 11, income: 1_200.5, spent: 300 }],
          categories: [{ categoryId: 7, name: 'Software', type: 'expense', spent: 300 }],
        },
      ],
    };
    request.flush(ok(dto));

    expect(result).toEqual({
      year: 2026,
      month: 11,
      currencies: [
        { currency: 'COP', income: 6_200_000, incomePayments: 3, spent: 2_360_000, committed: 1_000_000, history, categories },
        {
          currency: 'USD',
          income: 1_200.5,
          incomePayments: 1,
          spent: 300,
          committed: 0,
          history: [{ year: 2026, month: 11, income: 1_200.5, spent: 300 }],
          categories: [{ categoryId: 7, name: 'Software', type: 'expense', spent: 300 }],
        },
      ],
    });
  });

  it('treats a missing history or categories as empty lists', () => {
    let result: unknown;
    repository.summary({ year: 2026, month: 11 }).subscribe((value) => (result = value));

    http.expectOne(`${URL}?year=2026&month=11`).flush(
      ok({
        year: 2026,
        month: 11,
        currencies: [
          { currency: 'COP', income: 0, incomePayments: 0, spent: 0, committed: 20_000, history: null, categories: null },
          { currency: 'USD', income: 0, incomePayments: 0, spent: 0, committed: 20 },
        ],
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        currencies: [
          expect.objectContaining({ currency: 'COP', history: [], categories: [] }),
          expect.objectContaining({ currency: 'USD', history: [], categories: [] }),
        ],
      }),
    );
  });

  it('drops categories with an unknown type', () => {
    let result: { currencies: { categories: unknown[] }[] } | undefined;
    repository.summary({ year: 2026, month: 11 }).subscribe((value) => (result = value));

    http.expectOne(`${URL}?year=2026&month=11`).flush(
      ok({
        year: 2026,
        month: 11,
        currencies: [
          {
            currency: 'COP',
            income: 6_200_000,
            incomePayments: 3,
            spent: 1_270_000,
            committed: 0,
            history: [{ year: 2026, month: 11, income: 6_200_000, spent: 1_270_000 }],
            categories: [
              { categoryId: 1, name: 'Vivienda', type: 'expense', spent: 1_150_000 },
              { categoryId: 10, name: 'Salario', type: 'income', spent: 50_000 },
              { categoryId: 11, name: 'Rara', type: 'something-new', spent: 10_000 },
              { categoryId: 6, name: 'Ahorro', type: 'transfer', spent: 120_000 },
            ],
          },
        ],
      }),
    );

    expect(result!.currencies[0].categories).toEqual([
      { categoryId: 1, name: 'Vivienda', type: 'expense', spent: 1_150_000 },
      { categoryId: 6, name: 'Ahorro', type: 'transfer', spent: 120_000 },
    ]);
  });

  it('treats missing currencies as an empty month', () => {
    let result: unknown;
    repository.summary({ year: 2026, month: 1 }).subscribe((value) => (result = value));

    http.expectOne(`${URL}?year=2026&month=1`).flush(ok({ year: 2026, month: 1, currencies: null }));

    expect(result).toEqual({ year: 2026, month: 1, currencies: [] });
  });

  it('keeps the PERIOD_INVALID code and translates it', () => {
    let error: unknown;
    repository.summary({ year: 2026, month: 13 }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}?year=2026&month=13`)
      .flush(failure(DashboardErrorCode.PeriodInvalid), { status: 400, statusText: 'Bad Request' });

    expect(error).toBeInstanceOf(DashboardError);
    expect((error as DashboardError).code).toBe(DashboardErrorCode.PeriodInvalid);
    expect((error as DashboardError).message).toBe('That month is not valid.');
  });

  it('translates the code in the active language', () => {
    TestBed.inject(TranslocoService).setActiveLang('es-CO');
    let error: unknown;
    repository.summary({ year: 2026, month: 13 }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}?year=2026&month=13`)
      .flush(failure(DashboardErrorCode.PeriodInvalid), { status: 400, statusText: 'Bad Request' });

    expect((error as DashboardError).message).toBe('Ese mes no es válido.');
  });

  it('falls back to the backend message and a null code for unknown codes', () => {
    let error: unknown;
    repository.summary({ year: 2026, month: 11 }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}?year=2026&month=11`)
      .flush(failure('HTTP_403', 'Forbidden here.'), { status: 403, statusText: 'Forbidden' });

    expect(error).toBeInstanceOf(DashboardError);
    expect((error as DashboardError).code).toBeNull();
    expect((error as DashboardError).message).toBe('Forbidden here.');
  });

  it('rejects a 2xx whose envelope reports a failure', () => {
    let error: unknown;
    repository.summary({ year: 2026, month: 11 }).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}?year=2026&month=11`).flush(failure(DashboardErrorCode.PeriodInvalid));

    expect(error).toBeInstanceOf(DashboardError);
    expect((error as DashboardError).code).toBe(DashboardErrorCode.PeriodInvalid);
  });
});
