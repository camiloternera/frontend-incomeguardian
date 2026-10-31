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
  isGlobal: false,
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

  it('unwraps the envelope and maps the DTOs', () => {
    let result: unknown;
    repository.list().subscribe((value) => (result = value));

    http.expectOne(URL).flush({ data: [DTO], isSuccess: true, message: 'ok', errors: [] });

    expect(result).toEqual([
      {
        id: 7,
        name: 'Mascotas',
        description: 'Comida y veterinario',
        isGlobal: false,
        createdAt: '2026-10-29T12:00:00+00:00',
        updatedAt: null,
      },
    ]);
  });

  it('sends the draft on create and update', () => {
    repository.create({ name: 'Mascotas', description: 'Comida' }).subscribe();
    const create = http.expectOne(URL);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Mascotas', description: 'Comida' });
    create.flush({ data: DTO, isSuccess: true, message: 'ok', errors: [] }, { status: 201, statusText: 'Created' });

    repository.update(7, { name: 'Mascotas', description: 'Otra' }).subscribe();
    const update = http.expectOne(`${URL}/7`);
    expect(update.request.method).toBe('PUT');
    update.flush({ data: DTO, isSuccess: true, message: 'ok', errors: [] });
  });

  it('keeps the backend code and translates it', () => {
    let error: unknown;
    repository.create({ name: 'Comida', description: 'x' }).subscribe({ error: (value) => (error = value) });

    http
      .expectOne(URL)
      .flush(failure(CategoryErrorCode.NameAlreadyExists), { status: 409, statusText: 'Conflict' });

    expect(error).toBeInstanceOf(CategoryError);
    expect((error as CategoryError).code).toBe(CategoryErrorCode.NameAlreadyExists);
    expect((error as CategoryError).message).toBe('A category with that name already exists.');
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
    repository.remove(7).subscribe({ error: (value) => (error = value) });

    http.expectOne(`${URL}/7`).flush(failure('HTTP_403', 'Forbidden here.'), { status: 403, statusText: 'Forbidden' });

    expect((error as CategoryError).code).toBeNull();
    expect((error as CategoryError).message).toBe('Forbidden here.');
  });
});
