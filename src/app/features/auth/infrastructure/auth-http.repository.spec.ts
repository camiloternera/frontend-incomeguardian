import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { environment } from '@env/environment';
import { AuthError } from '../domain/auth-error';
import { AuthHttpRepository } from './auth-http.repository';

describe('AuthHttpRepository', () => {
  let repository: AuthHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), AuthHttpRepository],
    });
    repository = TestBed.inject(AuthHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  it('unwraps the login envelope into a session', () => {
    let session: unknown;
    repository.login({ email: 'user@example.com', password: 'secret' }).subscribe((value) => (session = value));

    http.expectOne('https://localhost:7151/api/v1/User/login').flush({
      data: {
        userId: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-08-09T12:00:00Z',
      },
      isSuccess: true,
      message: 'ok',
      errors: [],
    });

    expect(session).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-09T12:00:00Z',
    });
  });

  it('turns a 200 with isSuccess false into an AuthError with mapped copy', () => {
    let error: unknown;
    repository
      .register({ name: 'A', surname: 'B', email: 'a@b.co', password: 'x', phoneNumber: '1' })
      .subscribe({ error: (value) => (error = value) });

    http.expectOne('https://localhost:7151/api/v1/User').flush({
      data: null,
      isSuccess: false,
      messageKey: 'Ha ocurrido un error.',
      errors: [{ code: 'USER_ALREADY_EXISTS', message: 'El correo ya esta registrado.' }],
    });

    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).message).toBe('That email is already registered.');
  });

  it('translates mapped codes into the active language', () => {
    TestBed.inject(TranslocoService).setActiveLang('es-CO');
    let error: unknown;
    repository.confirmEmail({ email: 'a@b.co', code: '123456' }).subscribe({ error: (value) => (error = value) });

    http.expectOne('https://localhost:7151/api/v1/User/confirm').flush({
      data: null,
      isSuccess: false,
      errors: [{ code: 'VERIFICATION_CODE_EXPIRED', message: 'Codigo expirado.' }],
    });

    expect((error as AuthError).message).toBe('El código es incorrecto o ya expiró. Solicita uno nuevo.');
  });

  it('falls back to the backend message for unmapped codes', () => {
    let error: unknown;
    repository.confirmEmail({ email: 'a@b.co', code: '123456' }).subscribe({ error: (value) => (error = value) });

    http.expectOne('https://localhost:7151/api/v1/User/confirm').flush({
      data: null,
      isSuccess: false,
      errors: [{ code: 'SOMETHING_NEW', message: 'Something new happened.' }],
    });

    expect((error as AuthError).message).toBe('Something new happened.');
  });

  describe('logout', () => {
    const url = `${environment.apiUrl}/api/v1/User/logout`;

    it('posts without a body and completes on 204', () => {
      let completed = false;
      repository.logout().subscribe({ complete: () => (completed = true) });

      const request = http.expectOne(url);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toBeNull();
      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
    });

    it('treats a 401 as an already closed session', () => {
      let completed = false;
      repository.logout().subscribe({ complete: () => (completed = true) });

      http.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(completed).toBe(true);
    });

    it('fails with an AuthError when the backend cannot revoke the session', () => {
      let error: unknown;
      repository.logout().subscribe({ error: (value) => (error = value) });

      http.expectOne(url).flush(null, { status: 500, statusText: 'Server Error' });

      expect(error).toBeInstanceOf(AuthError);
    });
  });
});
