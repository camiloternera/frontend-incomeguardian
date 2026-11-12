import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { DashboardError, DashboardErrorCode } from '../domain/dashboard-error';
import { RecentMovement } from '../domain/recent-movement';
import { RecentMovementsHttpRepository } from './recent-movements-http.repository';
import { RecentMovementDto } from './recent-movements.dto';

const URL = `${environment.apiUrl}/api/v1/dashboard/recent`;

function ok<T>(data: T) {
  return { data, isSuccess: true, message: 'ok', errors: [] };
}

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

/** Un gasto en pesos tal como lo envía el backend, con cambios. */
function dto(changes: Partial<RecentMovementDto> = {}): RecentMovementDto {
  return {
    id: 1,
    type: 'expense',
    date: '2026-11-12T15:00:00Z',
    description: 'Mercado',
    amount: 186_400,
    currency: 'COP',
    categoryName: 'Comida',
    isCardPayment: false,
    installmentCount: 1,
    fromAccountName: 'Tarjeta Visa',
    toAccountName: null,
    destinationAmount: null,
    destinationCurrency: null,
    ...changes,
  };
}

describe('RecentMovementsHttpRepository', () => {
  let repository: RecentMovementsHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), RecentMovementsHttpRepository],
    });
    repository = TestBed.inject(RecentMovementsHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Pide `limit` movimientos, responde con `items` y devuelve lo que emitió el repositorio. */
  function fetch(items: RecentMovementDto[], limit = 6): RecentMovement[] {
    let result: RecentMovement[] = [];
    repository.recent(limit).subscribe((value) => (result = value));
    http.expectOne(`${URL}?limit=${limit}`).flush(ok(items));

    return result;
  }

  it('asks for the given number of movements', () => {
    repository.recent(6).subscribe();

    const request = http.expectOne((req) => req.url === URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('limit')).toBe('6');
    request.flush(ok([]));
  });

  it('maps every field and keeps the order received', () => {
    const result = fetch([
      dto({ id: 2, type: 'income', categoryName: 'Salario', fromAccountName: null, toAccountName: 'Bancolombia' }),
      dto({ id: 1, installmentCount: 3 }),
    ]);

    expect(result).toEqual([
      {
        id: 2,
        kind: 'income',
        date: '2026-11-12T15:00:00Z',
        day: '2026-11-12',
        description: 'Mercado',
        amount: 186_400,
        currency: 'COP',
        categoryName: 'Salario',
        isCardPayment: false,
        installments: 1,
        fromAccountName: null,
        toAccountName: 'Bancolombia',
        destination: null,
      },
      expect.objectContaining({ id: 1, kind: 'expense', installments: 3, fromAccountName: 'Tarjeta Visa' }),
    ]);
  });

  it('takes the day in Colombian time, not the UTC date', () => {
    // 02:00 UTC del 13 son las 21:00 del 12 en Colombia.
    const [movement] = fetch([dto({ date: '2026-11-13T02:00:00Z' })]);

    expect(movement.date).toBe('2026-11-13T02:00:00Z');
    expect(movement.day).toBe('2026-11-12');
  });

  it('keeps the card payment flag', () => {
    const [movement] = fetch([dto({ isCardPayment: true, description: null, categoryName: null })]);

    expect(movement.isCardPayment).toBe(true);
    expect(movement.categoryName).toBeNull();
  });

  it('turns a blank description into null', () => {
    const result = fetch([dto({ id: 1, description: '' }), dto({ id: 2, description: '   ' }), dto({ id: 3, description: null })]);

    expect(result.map((movement) => movement.description)).toEqual([null, null, null]);
  });

  it('trims the description', () => {
    const [movement] = fetch([dto({ description: '  Netflix  ' })]);

    expect(movement.description).toBe('Netflix');
  });

  it('defaults a missing card flag to false and missing installments to one', () => {
    const [movement] = fetch([dto({ isCardPayment: null, installmentCount: null })]);

    expect(movement.isCardPayment).toBe(false);
    expect(movement.installments).toBe(1);
  });

  it('drops movements of an unknown type', () => {
    const result = fetch([dto({ id: 1 }), dto({ id: 2, type: 'adjustment' }), dto({ id: 3, type: 'transfer' })]);

    expect(result.map((movement) => [movement.id, movement.kind])).toEqual([
      [1, 'expense'],
      [3, 'transfer'],
    ]);
  });

  describe('destination of a transfer', () => {
    function transfer(changes: Partial<RecentMovementDto>): RecentMovementDto {
      return dto({
        type: 'transfer',
        description: null,
        categoryName: null,
        amount: 400,
        currency: 'USD',
        fromAccountName: 'Wise',
        toAccountName: 'Bancolombia',
        ...changes,
      });
    }

    it('keeps what arrived in another currency', () => {
      const [movement] = fetch([transfer({ destinationAmount: 1_600_000, destinationCurrency: 'COP' })]);

      expect(movement.destination).toEqual({ amount: 1_600_000, currency: 'COP' });
    });

    it('ignores it when the currency is the same', () => {
      const [movement] = fetch([transfer({ destinationAmount: 400, destinationCurrency: 'USD' })]);

      expect(movement.destination).toBeNull();
    });

    it('ignores it when the amount or the currency is missing', () => {
      const result = fetch([
        transfer({ id: 1, destinationAmount: null, destinationCurrency: 'COP' }),
        transfer({ id: 2, destinationAmount: 1_600_000, destinationCurrency: null }),
        transfer({ id: 3, destinationAmount: 1_600_000, destinationCurrency: '' }),
      ]);

      expect(result.map((movement) => movement.destination)).toEqual([null, null, null]);
    });

    it('keeps a destination of zero', () => {
      const [movement] = fetch([transfer({ destinationAmount: 0, destinationCurrency: 'COP' })]);

      expect(movement.destination).toEqual({ amount: 0, currency: 'COP' });
    });

    it('ignores it outside a transfer', () => {
      const [movement] = fetch([dto({ type: 'income', destinationAmount: 1_600_000, destinationCurrency: 'USD' })]);

      expect(movement.destination).toBeNull();
    });
  });

  it('returns an empty list when there are no movements', () => {
    expect(fetch([])).toEqual([]);
  });

  it('keeps the DASHBOARD_RECENT_LIMIT_INVALID code and translates it', () => {
    let error: unknown;
    repository.recent(50).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}?limit=50`)
      .flush(failure(DashboardErrorCode.RecentLimitInvalid), { status: 400, statusText: 'Bad Request' });

    expect(error).toBeInstanceOf(DashboardError);
    expect((error as DashboardError).code).toBe(DashboardErrorCode.RecentLimitInvalid);
    expect((error as DashboardError).message).toBe('The number of recent transactions must be between 1 and 20.');
  });

  it('translates the code in the active language', () => {
    TestBed.inject(TranslocoService).setActiveLang('es-CO');
    let error: unknown;
    repository.recent(50).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}?limit=50`)
      .flush(failure(DashboardErrorCode.RecentLimitInvalid), { status: 400, statusText: 'Bad Request' });

    expect((error as DashboardError).message).toBe('La cantidad de movimientos recientes debe estar entre 1 y 20.');
  });

  it('falls back to the backend message and a null code for unknown codes', () => {
    let error: unknown;
    repository.recent(6).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}?limit=6`).flush(failure('HTTP_403', 'Forbidden here.'), { status: 403, statusText: 'Forbidden' });

    expect(error).toBeInstanceOf(DashboardError);
    expect((error as DashboardError).code).toBeNull();
    expect((error as DashboardError).message).toBe('Forbidden here.');
  });

  it('rejects a 2xx whose envelope reports a failure', () => {
    let error: unknown;
    repository.recent(6).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}?limit=6`).flush(failure(DashboardErrorCode.RecentLimitInvalid));

    expect(error).toBeInstanceOf(DashboardError);
    expect((error as DashboardError).code).toBe(DashboardErrorCode.RecentLimitInvalid);
  });

  it('rejects a 2xx without data', () => {
    let error: unknown;
    repository.recent(6).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}?limit=6`).flush({ data: null, isSuccess: true, message: 'ok', errors: [] });

    expect(error).toBeInstanceOf(DashboardError);
  });
});
