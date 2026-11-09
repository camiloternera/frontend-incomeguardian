import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { PeriodError, PeriodErrorCode } from '../domain/period-error';
import { PeriodHttpRepository } from './period-http.repository';
import { PeriodMonthDto, PeriodYearDto } from './period.dto';

const URL = `${environment.apiUrl}/api/v1/periods`;

function monthDto(month: number, status = 'closed', overrides: Partial<PeriodMonthDto> = {}): PeriodMonthDto {
  return {
    month,
    status,
    closedAt: status === 'closed' ? '2026-02-01T05:00:00Z' : null,
    closedAutomatically: false,
    reopenedAt: null,
    recloseMode: null,
    recloseAt: null,
    autoCloseOn: null,
    canClose: false,
    canReopen: status === 'closed',
    ...overrides,
  };
}

function yearDto(overrides: Partial<PeriodYearDto> = {}): PeriodYearDto {
  return {
    year: 2026,
    yearClosed: false,
    yearClosedAt: null,
    yearClosedAutomatically: false,
    canCloseYear: false,
    canReopenYear: false,
    firstActivity: '2026-01',
    months: Array.from({ length: 12 }, (_, index) => monthDto(index + 1, index < 9 ? 'closed' : index === 9 ? 'pending' : 'future')),
    ...overrides,
  };
}

const TOTALS = { currency: 'COP', income: 4_500_000, expense: 2_100_000, savings: 2_400_000, savingsRate: 53.3 };
const BALANCE = { accountId: 2, name: 'Bancolombia', currency: 'COP', balance: 1_250_000, isActive: true };

function ok<T>(data: T) {
  return { data, isSuccess: true, message: 'ok', errors: [] };
}

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

describe('PeriodHttpRepository', () => {
  let repository: PeriodHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), PeriodHttpRepository],
    });
    repository = TestBed.inject(PeriodHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for a year and returns its months from January to December', () => {
    let result: unknown;
    repository.year(2026).subscribe((value) => (result = value));
    const months = yearDto().months;

    http.expectOne(`${URL}?year=2026`).flush(ok(yearDto({ months: [...months].reverse() })));

    expect(result).toEqual(
      expect.objectContaining({
        year: 2026,
        yearClosed: false,
        firstActivity: '2026-01',
        months: expect.arrayContaining([expect.objectContaining({ month: 10, status: 'pending' })]),
      }),
    );
    expect((result as { months: { month: number }[] }).months.map((month) => month.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('keeps a known reclose mode and drops an unknown one', () => {
    let result: { months: { recloseMode: unknown }[] } | undefined;
    repository.year(2026).subscribe((value) => (result = value));
    const months = yearDto().months;
    months[0] = monthDto(1, 'pending', { reopenedAt: '2026-11-08T15:00:00Z', recloseMode: 'manual' });
    months[1] = monthDto(2, 'pending', { recloseMode: 'sometimes' });

    http.expectOne(`${URL}?year=2026`).flush(ok(yearDto({ months })));

    expect(result!.months[0].recloseMode).toBe('manual');
    expect(result!.months[1].recloseMode).toBeNull();
  });

  it('treats an unknown month status as an invalid response', () => {
    let error: unknown;
    repository.year(2026).subscribe({ error: (value) => (error = value) });
    const months = yearDto().months;
    months[3] = monthDto(4, 'archived');

    http.expectOne(`${URL}?year=2026`).flush(ok(yearDto({ months })));

    expect(error).toBeInstanceOf(PeriodError);
    expect((error as PeriodError).code).toBeNull();
    expect((error as PeriodError).message).toBe('Something went wrong. Please try again.');
  });

  it('returns the pending month, or null when there is none', () => {
    const results: unknown[] = [];
    repository.pending().subscribe((value) => results.push(value));
    http
      .expectOne(`${URL}/pending`)
      .flush(ok({ year: 2026, month: 10, endedOn: '2026-10-31', autoCloseOn: '2026-11-05', canClose: true }));

    repository.pending().subscribe((value) => results.push(value));
    http.expectOne(`${URL}/pending`).flush(ok(null));

    expect(results).toEqual([
      { year: 2026, month: 10, endedOn: '2026-10-31', autoCloseOn: '2026-11-05', canClose: true },
      null,
    ]);
  });

  it('rejects a successful envelope without data where data is required', () => {
    let error: unknown;
    repository.year(2026).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}?year=2026`).flush(ok(null));

    expect(error).toBeInstanceOf(PeriodError);
  });

  it('reviews a month with its state, totals and balances', () => {
    let result: unknown;
    repository.review({ year: 2026, month: 10 }).subscribe((value) => (result = value));

    http.expectOne(`${URL}/2026/10/review`).flush(
      ok({ year: 2026, state: monthDto(10, 'pending'), totals: [TOTALS], balances: [BALANCE], uncategorizedCount: 3 }),
    );

    expect(result).toEqual({
      year: 2026,
      month: 10,
      monthState: expect.objectContaining({ month: 10, status: 'pending' }),
      yearState: null,
      totals: [TOTALS],
      balances: [BALANCE],
      uncategorizedCount: 3,
    });
  });

  it('reviews a whole year with the state of its months', () => {
    let result: unknown;
    repository.review({ year: 2026, month: null }).subscribe((value) => (result = value));

    http.expectOne(`${URL}/2026/review`).flush(ok({ state: yearDto(), totals: [TOTALS], balances: [], uncategorizedCount: 0 }));

    expect(result).toEqual(
      expect.objectContaining({ year: 2026, month: null, monthState: null, yearState: expect.objectContaining({ year: 2026 }) }),
    );
  });

  it('closes and reopens months with a POST', () => {
    repository.closeMonth(2026, 10).subscribe();
    const close = http.expectOne(`${URL}/2026/10/close`);
    expect(close.request.method).toBe('POST');
    close.flush(ok(monthDto(10)));

    repository.reopenMonth(2026, 9, { recloseMode: 'manual', reason: 'Faltó un gasto' }).subscribe();
    const reopen = http.expectOne(`${URL}/2026/9/reopen`);
    expect(reopen.request.method).toBe('POST');
    expect(reopen.request.body).toEqual({ recloseMode: 'manual', reason: 'Faltó un gasto' });
    reopen.flush(ok(monthDto(9, 'pending')));

    // Sin modo elegido, el mes vuelve a cerrarse solo.
    repository.reopenMonth(2026, 9, { reason: null }).subscribe();
    const reopenAuto = http.expectOne(`${URL}/2026/9/reopen`);
    expect(reopenAuto.request.body).toEqual({ recloseMode: 'auto', reason: null });
    reopenAuto.flush(ok(monthDto(9, 'pending')));
  });

  it('closes and reopens a year with a POST', () => {
    let closed: unknown;
    repository.closeYear(2025).subscribe((value) => (closed = value));
    const close = http.expectOne(`${URL}/2025/close`);
    expect(close.request.method).toBe('POST');
    close.flush(ok(yearDto({ year: 2025, yearClosed: true })));
    expect(closed).toEqual(expect.objectContaining({ year: 2025, yearClosed: true }));

    repository.reopenYear(2025, 'Ajuste').subscribe();
    const reopen = http.expectOne(`${URL}/2025/reopen`);
    expect(reopen.request.body).toEqual({ reason: 'Ajuste' });
    reopen.flush(ok(yearDto({ year: 2025 })));
  });

  it('maps the history and uses a null month for whole-year events', () => {
    let result: unknown;
    repository.history(20).subscribe((value) => (result = value));

    http.expectOne(`${URL}/history?limit=20`).flush(
      ok([
        { year: 2026, month: 9, action: 'reopen', automatic: false, reason: 'Faltó un gasto', createdAt: '2026-11-02T15:00:00Z' },
        { year: 2025, month: 0, action: 'close', automatic: true, reason: null, createdAt: '2026-01-05T05:00:00Z' },
      ]),
    );

    expect(result).toEqual([
      { year: 2026, month: 9, action: 'reopen', automatic: false, reason: 'Faltó un gasto', createdAt: '2026-11-02T15:00:00Z' },
      { year: 2025, month: null, action: 'close', automatic: true, reason: null, createdAt: '2026-01-05T05:00:00Z' },
    ]);
  });

  it('treats an unknown history action as an invalid response', () => {
    let error: unknown;
    repository.history(20).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}/history?limit=20`)
      .flush(ok([{ year: 2026, month: 9, action: 'archive', automatic: false, reason: null, createdAt: '2026-11-02T15:00:00Z' }]));

    expect((error as PeriodError).message).toBe('Something went wrong. Please try again.');
  });

  it('reads and saves the closing settings', () => {
    const settings = { autoCloseEnabled: true, autoCloseDay: 5, closeYearWithDecember: false, remindOnMonthEnd: true };
    let read: unknown;
    repository.settings().subscribe((value) => (read = value));
    http.expectOne(`${URL}/settings`).flush(ok(settings));
    expect(read).toEqual(settings);

    repository.saveSettings({ ...settings, autoCloseDay: 10 }).subscribe();
    const save = http.expectOne(`${URL}/settings`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ ...settings, autoCloseDay: 10 });
    save.flush(ok({ ...settings, autoCloseDay: 10 }));
  });

  it('keeps the backend code and translates it', () => {
    let error: unknown;
    repository.closeMonth(2026, 11).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/2026/11/close`).flush(failure(PeriodErrorCode.NotEnded), { status: 409, statusText: 'Conflict' });

    expect(error).toBeInstanceOf(PeriodError);
    expect((error as PeriodError).code).toBe(PeriodErrorCode.NotEnded);
    expect((error as PeriodError).message).toBe("This period hasn't ended yet; you can close it once it does.");
  });

  it('interpolates the reason limit in the active language', () => {
    TestBed.inject(TranslocoService).setActiveLang('es-CO');
    let error: unknown;
    repository.reopenMonth(2026, 9, { recloseMode: 'auto', reason: 'x'.repeat(300) }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}/2026/9/reopen`)
      .flush(failure(PeriodErrorCode.ReasonMaxLength), { status: 400, statusText: 'Bad Request' });

    expect((error as PeriodError).message).toBe('El motivo admite hasta 200 caracteres.');
  });

  it('falls back to the backend message and a null code for unknown codes', () => {
    let error: unknown;
    repository.settings().subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/settings`).flush(failure('HTTP_403', 'Forbidden here.'), { status: 403, statusText: 'Forbidden' });

    expect((error as PeriodError).code).toBeNull();
    expect((error as PeriodError).message).toBe('Forbidden here.');
  });
});
