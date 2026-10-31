import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '@env/environment';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { PreferencesError, PreferencesErrorCode } from '../domain/preferences-error';
import { PreferencesHttpRepository } from './preferences-http.repository';

const URL = `${environment.apiUrl}/api/v1/User/preferences`;

function ok(data: unknown) {
  return { data, isSuccess: true, message: 'ok', errors: [] };
}

describe('PreferencesHttpRepository', () => {
  let repository: PreferencesHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), PreferencesHttpRepository],
    });
    repository = TestBed.inject(PreferencesHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the preferences out of the envelope', () => {
    let result: unknown;
    repository.get().subscribe((value) => (result = value));

    http.expectOne(URL).flush(ok({ theme: 'noir', language: 'en-US' }));

    expect(result).toEqual({ theme: 'noir', language: 'en-US' });
  });

  it('saves with a PUT and returns what the backend kept', () => {
    let result: unknown;
    repository.save({ theme: 'paper', language: 'es-CO' }).subscribe((value) => (result = value));

    const request = http.expectOne(URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ theme: 'paper', language: 'es-CO' });
    request.flush(ok({ theme: 'paper', language: 'es-CO' }));

    expect(result).toEqual({ theme: 'paper', language: 'es-CO' });
  });

  it('keeps the backend code and translates it', () => {
    TestBed.inject(TranslocoService).setActiveLang('es-CO');
    let error: unknown;
    repository.save({ theme: 'paper', language: 'es-CO' }).subscribe({ error: (value) => (error = value) });

    http.expectOne(URL).flush(
      { data: null, isSuccess: false, message: '', errors: [{ code: PreferencesErrorCode.ThemeInvalid, message: 'x' }] },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error).toBeInstanceOf(PreferencesError);
    expect((error as PreferencesError).code).toBe(PreferencesErrorCode.ThemeInvalid);
    expect((error as PreferencesError).message).toBe('Ese tema no está disponible. Elige uno de la lista.');
  });

  it('rejects values the app does not know', () => {
    let error: unknown;
    repository.get().subscribe({ error: (value) => (error = value) });

    http.expectOne(URL).flush(ok({ theme: 'chartreuse', language: 'fr-FR' }));

    expect(error).toBeInstanceOf(PreferencesError);
    expect((error as PreferencesError).code).toBeNull();
  });
});
