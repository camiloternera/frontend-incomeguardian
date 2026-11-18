import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { Cushion, CushionCandidate } from '../domain/cushion';
import { DashboardError, DashboardErrorCode } from '../domain/dashboard-error';
import { CushionHttpRepository } from './cushion-http.repository';
import { CushionCurrencyDto } from './cushion.dto';

const API = `${environment.apiUrl}/api/v1`;

function ok<T>(data: T) {
  return { data, isSuccess: true, message: 'ok', errors: [] };
}

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

function currency(changes: Partial<CushionCurrencyDto> = {}): CushionCurrencyDto {
  return {
    currency: 'COP',
    savings: 9_360_000,
    averageMonthlySpent: 3_900_000,
    monthsUsed: 5,
    monthsCovered: 2.4,
    monthsCoveredReason: null,
    goalAmount: 23_400_000,
    missing: 14_040_000,
    accounts: [{ id: 1, name: 'Davivienda ahorros', balance: 9_360_000 }],
    ...changes,
  };
}

describe('CushionHttpRepository', () => {
  let repository: CushionHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), CushionHttpRepository],
    });
    repository = TestBed.inject(CushionHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps the cushion, puts pesos first and translates the reason', () => {
    let result: Cushion | undefined;
    repository.cushion().subscribe((value) => (result = value));

    http.expectOne(`${API}/dashboard/cushion`).flush(
      ok({
        goalMonths: 9,
        hasCushionAccounts: true,
        currencies: [
          currency({ currency: 'USD', monthsCovered: null, monthsCoveredReason: 'NO_SPENDING', goalAmount: null, missing: null, accounts: null }),
          currency(),
        ],
      }),
    );

    expect(result!.goalMonths).toBe(9);
    expect(result!.currencies.map((row) => row.currency)).toEqual(['COP', 'USD']);
    expect(result!.currencies[0]).toEqual(
      expect.objectContaining({ monthsCovered: 2.4, reason: null, missing: 14_040_000, accounts: [{ id: 1, name: 'Davivienda ahorros', balance: 9_360_000 }] }),
    );
    expect(result!.currencies[1]).toEqual(expect.objectContaining({ monthsCovered: null, reason: 'noSpending', accounts: [] }));
  });

  it('reads NO_PREVIOUS_MONTHS as the reason when there are no earlier months', () => {
    let result: Cushion | undefined;
    repository.cushion().subscribe((value) => (result = value));

    http
      .expectOne(`${API}/dashboard/cushion`)
      .flush(ok({ goalMonths: 6, hasCushionAccounts: true, currencies: [currency({ monthsCovered: null, monthsCoveredReason: 'NO_PREVIOUS_MONTHS' })] }));

    expect(result!.currencies[0].reason).toBe('noPreviousMonths');
  });

  it('offers only active accounts that are not credit cards, with their mark', () => {
    let result: CushionCandidate[] = [];
    repository.candidates().subscribe((value) => (result = value));

    http.expectOne(`${API}/accounts`).flush(
      ok([
        { id: 1, name: 'Ahorros', kind: 'standard', currency: 'COP', currentBalance: 5_000, initialBalance: 1_000, isActive: true, isCushion: true },
        { id: 2, name: 'Visa', kind: 'credit_card', currency: 'COP', currentBalance: -900, initialBalance: 0, isActive: true, isCushion: false },
        { id: 3, name: 'Vieja', kind: 'standard', currency: 'COP', currentBalance: 10, initialBalance: 10, isActive: false, isCushion: true },
        { id: 4, name: 'Wise', currency: 'USD', currentBalance: null, initialBalance: 300, isActive: true },
      ]),
    );

    expect(result).toEqual([
      { id: 1, name: 'Ahorros', currency: 'COP', balance: 5_000, isCushion: true },
      { id: 4, name: 'Wise', currency: 'USD', balance: 300, isCushion: false },
    ]);
  });

  it('saves the accounts with a PUT', () => {
    let done = false;
    repository.saveAccounts([3, 1]).subscribe(() => (done = true));

    const request = http.expectOne(`${API}/accounts/cushion`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ accountIds: [3, 1] });
    request.flush(ok({ accountIds: [1, 3] }));

    expect(done).toBe(true);
  });

  it('saves the goal keeping the current theme and language', () => {
    let done = false;
    repository.saveGoal(9).subscribe(() => (done = true));

    http.expectOne({ method: 'GET', url: `${API}/User/preferences` }).flush(ok({ theme: 'noir', language: 'en-US', cushionGoalMonths: 6 }));
    const put = http.expectOne({ method: 'PUT', url: `${API}/User/preferences` });
    expect(put.request.body).toEqual({ theme: 'noir', language: 'en-US', cushionGoalMonths: 9 });
    put.flush(ok({ theme: 'noir', language: 'en-US', cushionGoalMonths: 9 }));

    expect(done).toBe(true);
  });

  it('keeps the backend code with its own copy when saving fails', () => {
    let error: unknown;
    repository.saveAccounts([2]).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${API}/accounts/cushion`).flush(failure(DashboardErrorCode.CushionCreditCard), { status: 400, statusText: 'Bad Request' });

    expect(error).toBeInstanceOf(DashboardError);
    expect((error as DashboardError).code).toBe(DashboardErrorCode.CushionCreditCard);
    expect((error as DashboardError).message).toBe("A credit card can't be part of the cushion.");
  });

  it('does not wrap twice an error of the goal request', () => {
    let error: unknown;
    repository.saveGoal(30).subscribe({ error: (value) => (error = value) });

    http.expectOne({ method: 'GET', url: `${API}/User/preferences` }).flush(ok({ theme: 'forest', language: 'es-CO' }));
    http
      .expectOne({ method: 'PUT', url: `${API}/User/preferences` })
      .flush(failure(DashboardErrorCode.CushionGoalInvalid), { status: 400, statusText: 'Bad Request' });

    expect((error as DashboardError).code).toBe(DashboardErrorCode.CushionGoalInvalid);
  });
});
