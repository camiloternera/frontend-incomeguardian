import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { AccountError, AccountErrorCode } from '../domain/account-error';
import { AccountHttpRepository, AccountTypeOptionsHttpRepository } from './account-http.repository';

const URL = `${environment.apiUrl}/api/v1/accounts`;

const DTO = {
  id: 5,
  name: 'Visa 4417',
  accountType: { id: 3, name: 'Tarjeta de crédito' },
  initialBalance: -250000.5,
  currentBalance: null,
  currency: 'COP',
  isActive: true,
  createdAt: '2026-10-31T12:00:00+00:00',
  updatedAt: null,
};

function ok(data: unknown) {
  return { data, isSuccess: true, message: 'ok', errors: [] };
}

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

describe('AccountHttpRepository', () => {
  let repository: AccountHttpRepository;
  let options: AccountTypeOptionsHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), AccountHttpRepository, AccountTypeOptionsHttpRepository],
    });
    repository = TestBed.inject(AccountHttpRepository);
    options = TestBed.inject(AccountTypeOptionsHttpRepository);
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
        accountType: { id: 3, name: 'Tarjeta de crédito' },
        initialBalance: -250000.5,
        currentBalance: -250000.5,
        currency: 'COP',
        isActive: true,
        createdAt: '2026-10-31T12:00:00+00:00',
        updatedAt: null,
      },
    ]);
  });

  it('sends the draft with its currency on create and update', () => {
    const draft = { name: 'Wise', accountTypeId: 1, initialBalance: 320.5, currency: 'USD' as const };

    repository.create(draft).subscribe();
    const create = http.expectOne(URL);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Wise', accountTypeId: 1, initialBalance: 320.5, currency: 'USD' });
    create.flush(ok({ ...DTO, currency: 'USD' }), { status: 201, statusText: 'Created' });

    repository.update(5, draft).subscribe();
    const update = http.expectOne(`${URL}/5`);
    expect(update.request.method).toBe('PUT');
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
    repository.update(5, { name: 'Wise', accountTypeId: 1, initialBalance: 0, currency: 'EUR' }).subscribe({
      error: (value) => (error = value),
    });

    http.expectOne(`${URL}/5`).flush(failure(AccountErrorCode.CurrencyLocked), { status: 409, statusText: 'Conflict' });

    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).code).toBe(AccountErrorCode.CurrencyLocked);
    expect((error as AccountError).message).toBe('The account already has transactions, so its currency cannot change.');
  });

  it('rejects a currency the app does not know', () => {
    let error: unknown;
    repository.get(5).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/5`).flush(ok({ ...DTO, currency: 'JPY' }));

    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).code).toBeNull();
  });

  it('reads only the id and name of the account types', () => {
    let result: unknown;
    options.list().subscribe((value) => (result = value));

    http
      .expectOne(`${environment.apiUrl}/api/v1/account-types`)
      .flush(ok([{ id: 1, name: 'Ahorros', description: 'Banco', isActive: true, createdAt: 'x', updatedAt: null }]));

    expect(result).toEqual([{ id: 1, name: 'Ahorros' }]);
  });
});
