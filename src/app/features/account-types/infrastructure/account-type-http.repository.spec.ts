import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { AccountTypeError, AccountTypeErrorCode } from '../domain/account-type-error';
import { AccountTypeHttpRepository } from './account-type-http.repository';

const URL = `${environment.apiUrl}/api/v1/account-types`;

const DTO = {
  id: 4,
  name: 'Tarjeta de crédito',
  description: 'Tarjetas con cupo',
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

describe('AccountTypeHttpRepository', () => {
  let repository: AccountTypeHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), AccountTypeHttpRepository],
    });
    repository = TestBed.inject(AccountTypeHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps the envelope and maps the DTOs', () => {
    let result: unknown;
    repository.list().subscribe((value) => (result = value));

    http.expectOne(URL).flush(ok([DTO]));

    expect(result).toEqual([
      {
        id: 4,
        name: 'Tarjeta de crédito',
        description: 'Tarjetas con cupo',
        createdAt: '2026-10-31T12:00:00+00:00',
        updatedAt: null,
      },
    ]);
  });

  it('sends the draft on create and update', () => {
    repository.create({ name: 'Ahorros', description: 'Cuentas de ahorro' }).subscribe();
    const create = http.expectOne(URL);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Ahorros', description: 'Cuentas de ahorro' });
    create.flush(ok(DTO), { status: 201, statusText: 'Created' });

    repository.update(4, { name: 'Ahorros', description: 'Otra' }).subscribe();
    const update = http.expectOne(`${URL}/4`);
    expect(update.request.method).toBe('PUT');
    update.flush(ok(DTO));
  });

  it('deactivates with a DELETE even when the envelope carries no data', () => {
    let done = false;
    repository.deactivate(4).subscribe(() => (done = true));

    const request = http.expectOne(`${URL}/4`);
    expect(request.request.method).toBe('DELETE');
    request.flush(ok(null));

    expect(done).toBe(true);
  });

  it('keeps the backend code and translates it', () => {
    let error: unknown;
    repository.create({ name: 'Ahorros', description: 'x' }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(URL)
      .flush(failure(AccountTypeErrorCode.NameAlreadyExists), { status: 409, statusText: 'Conflict' });

    expect(error).toBeInstanceOf(AccountTypeError);
    expect((error as AccountTypeError).code).toBe(AccountTypeErrorCode.NameAlreadyExists);
    expect((error as AccountTypeError).message).toBe('You already have an account type with that name.');
  });

  it('interpolates the length limits in the active language', () => {
    TestBed.inject(TranslocoService).setActiveLang('es-CO');
    let error: unknown;
    repository.update(4, { name: 'x'.repeat(31), description: 'x' }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}/4`)
      .flush(failure(AccountTypeErrorCode.NameMaxLength), { status: 400, statusText: 'Bad Request' });

    expect((error as AccountTypeError).message).toBe('El nombre puede tener hasta 30 caracteres.');
  });

  it('falls back to the backend message and a null code for unknown codes', () => {
    let error: unknown;
    repository.deactivate(4).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/4`).flush(failure('HTTP_403', 'Forbidden here.'), { status: 403, statusText: 'Forbidden' });

    expect((error as AccountTypeError).code).toBeNull();
    expect((error as AccountTypeError).message).toBe('Forbidden here.');
  });
});
