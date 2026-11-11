import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { CategoryError, CategoryErrorCode } from '../domain/category-error';
import { CategoryHttpRepository } from './category-http.repository';

const URL = `${environment.apiUrl}/api/v1/categories`;

const DTO = {
  id: 7,
  name: 'Mascotas',
  description: 'Comida y veterinario',
  transactionTypeId: 2,
  transactionTypeName: 'Gasto',
  isActive: true,
  createdAt: '2026-10-29T12:00:00+00:00',
  updatedAt: null,
};

function failure(code: string, message = 'Backend message') {
  return { data: null, isSuccess: false, message: '', errors: [{ code, message }] };
}

describe('CategoryHttpRepository', () => {
  let repository: CategoryHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), CategoryHttpRepository],
    });
    repository = TestBed.inject(CategoryHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for every status, unwraps the envelope and maps the DTOs', () => {
    let result: unknown;
    repository.list().subscribe((value) => (result = value));

    http
      .expectOne(`${URL}?status=all`)
      .flush({ data: [DTO, { ...DTO, id: 8, isActive: false }], isSuccess: true, message: 'ok', errors: [] });

    expect(result).toEqual([
      {
        id: 7,
        name: 'Mascotas',
        description: 'Comida y veterinario',
        type: 'expense',
        isActive: true,
        // Sin el campo en la respuesta, la categoría se toma como sin movimientos.
        hasTransactions: false,
        // Sin el campo, la categoría es del usuario.
        code: null,
        createdAt: '2026-10-29T12:00:00+00:00',
        updatedAt: null,
      },
      expect.objectContaining({ id: 8, isActive: false }),
    ]);
  });

  it('maps whether the category has transactions', () => {
    let result: { hasTransactions: boolean }[] | undefined;
    repository.list().subscribe((value) => (result = value));

    http.expectOne(`${URL}?status=all`).flush({
      data: [
        { ...DTO, id: 7, hasTransactions: true },
        { ...DTO, id: 8, hasTransactions: false },
        { ...DTO, id: 9, hasTransactions: null },
      ],
      isSuccess: true,
      message: 'ok',
      errors: [],
    });

    expect(result!.map((category) => category.hasTransactions)).toEqual([true, false, false]);
  });

  it('maps the code of a system category', () => {
    let result: { code: string | null }[] | undefined;
    repository.list().subscribe((value) => (result = value));

    http.expectOne(`${URL}?status=all`).flush({
      data: [
        { ...DTO, id: 7, code: 'CARD_PAYMENT', transactionTypeId: 3 },
        { ...DTO, id: 8, code: null },
      ],
      isSuccess: true,
      message: 'ok',
      errors: [],
    });

    expect(result!.map((category) => category.code)).toEqual(['CARD_PAYMENT', null]);
  });

  it('skips categories of an unknown type', () => {
    let result: unknown;
    repository.list().subscribe((value) => (result = value));

    http.expectOne(`${URL}?status=all`).flush({ data: [{ ...DTO, transactionTypeId: 9 }], isSuccess: true, message: 'ok', errors: [] });

    expect(result).toEqual([]);
  });

  it('sends the type id on create and only name and description on update', () => {
    repository.create({ name: 'Mascotas', description: 'Comida', type: 'transfer' }).subscribe();
    const create = http.expectOne(URL);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Mascotas', description: 'Comida', transactionTypeId: 3 });
    create.flush({ data: DTO, isSuccess: true, message: 'ok', errors: [] }, { status: 201, statusText: 'Created' });

    repository.update(7, { name: 'Mascotas', description: 'Otra' }).subscribe();
    const update = http.expectOne(`${URL}/7`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ name: 'Mascotas', description: 'Otra' });
    update.flush({ data: DTO, isSuccess: true, message: 'ok', errors: [] });
  });

  it('deactivates and activates with a PATCH and returns the updated category', () => {
    let deactivated: unknown;
    repository.deactivate(7).subscribe((value) => (deactivated = value));
    const deactivate = http.expectOne(`${URL}/7/deactivate`);
    expect(deactivate.request.method).toBe('PATCH');
    deactivate.flush({ data: { ...DTO, isActive: false }, isSuccess: true, message: 'ok', errors: [] });
    expect(deactivated).toEqual(expect.objectContaining({ id: 7, isActive: false }));

    let activated: unknown;
    repository.activate(7).subscribe((value) => (activated = value));
    const activate = http.expectOne(`${URL}/7/activate`);
    expect(activate.request.method).toBe('PATCH');
    activate.flush({ data: DTO, isSuccess: true, message: 'ok', errors: [] });
    expect(activated).toEqual(expect.objectContaining({ id: 7, isActive: true }));
  });

  it('keeps the conflict code when the category already has the requested status', () => {
    let error: unknown;
    repository.activate(7).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}/7/activate`)
      .flush(failure(CategoryErrorCode.AlreadyActive), { status: 409, statusText: 'Conflict' });

    expect((error as CategoryError).code).toBe(CategoryErrorCode.AlreadyActive);
    expect((error as CategoryError).message).toBe('This category was already active.');
  });

  it('keeps the backend code and translates it', () => {
    let error: unknown;
    repository.create({ name: 'Comida', description: 'x', type: 'expense' }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(URL)
      .flush(failure(CategoryErrorCode.NameAlreadyExists), { status: 409, statusText: 'Conflict' });

    expect(error).toBeInstanceOf(CategoryError);
    expect((error as CategoryError).code).toBe(CategoryErrorCode.NameAlreadyExists);
    expect((error as CategoryError).message).toBe('A category with that name already exists.');
  });

  it('keeps the locked name code and translates it in both languages', () => {
    let error: unknown;
    repository.update(7, { name: 'Mascota', description: 'x' }).subscribe({ error: (value) => (error = value) });
    http.expectOne(`${URL}/7`).flush(failure(CategoryErrorCode.NameLocked), { status: 409, statusText: 'Conflict' });

    expect((error as CategoryError).code).toBe(CategoryErrorCode.NameLocked);
    expect((error as CategoryError).message).toBe('The category already has transactions, so its name cannot change.');

    TestBed.inject(TranslocoService).setActiveLang('es-CO');
    repository.update(7, { name: 'Mascota', description: 'x' }).subscribe({ error: (value) => (error = value) });
    http.expectOne(`${URL}/7`).flush(failure(CategoryErrorCode.NameLocked), { status: 409, statusText: 'Conflict' });

    expect((error as CategoryError).message).toBe('La categoría ya tiene movimientos, así que su nombre no se puede cambiar.');
  });

  it('keeps the system lock code and translates it', () => {
    let error: unknown;
    repository.update(7, { name: 'Pagos', description: 'x' }).subscribe({ error: (value) => (error = value) });
    http.expectOne(`${URL}/7`).flush(failure(CategoryErrorCode.SystemLocked), { status: 409, statusText: 'Conflict' });

    expect((error as CategoryError).code).toBe(CategoryErrorCode.SystemLocked);
    expect((error as CategoryError).message).toBe("This is a system category: it can't be renamed, deactivated or deleted.");
  });

  it('interpolates the length limits in the active language', () => {
    TestBed.inject(TranslocoService).setActiveLang('es-CO');
    let error: unknown;
    repository.update(7, { name: 'x'.repeat(30), description: 'x' }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(`${URL}/7`)
      .flush(failure(CategoryErrorCode.NameMaxLength), { status: 400, statusText: 'Bad Request' });

    expect((error as CategoryError).message).toBe('El nombre puede tener hasta 20 caracteres.');
  });

  it('falls back to the backend message and a null code for unknown codes', () => {
    let error: unknown;
    repository.deactivate(7).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/7/deactivate`).flush(failure('HTTP_403', 'Forbidden here.'), { status: 403, statusText: 'Forbidden' });

    expect((error as CategoryError).code).toBeNull();
    expect((error as CategoryError).message).toBe('Forbidden here.');
  });
});
