import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RegisterPageComponent } from './register-page.component';
import { routes } from '../../../../../app.routes';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { provideAuth } from '../../../auth.providers';

const REGISTER_URL = 'https://localhost:7151/api/v1/User';

interface FormValues {
  name?: string;
  surname?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: boolean;
}

function fill(element: HTMLElement, values: FormValues = {}): void {
  const filled: Required<FormValues> = {
    name: 'Camilo',
    surname: 'Ternera',
    email: 'camilo@example.com',
    phoneNumber: '+57 300 000 0000',
    password: 'super-secret',
    confirmPassword: 'super-secret',
    acceptTerms: true,
    ...values,
  };

  for (const id of ['name', 'surname', 'email', 'phoneNumber', 'password', 'confirmPassword'] as const) {
    const input = element.querySelector(`#${id}`) as HTMLInputElement;
    input.value = filled[id];
    input.dispatchEvent(new Event('input'));
  }

  const terms = element.querySelector('#acceptTerms') as HTMLInputElement;
  terms.checked = filled.acceptTerms;
  terms.dispatchEvent(new Event('change'));
}

function submit(element: HTMLElement): void {
  (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
}

describe('RegisterPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RegisterPageComponent, translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes), provideAuth()],
    }).compileComponents();
  });

  it('posts exactly the fields the endpoint contract declares', () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    fill(fixture.nativeElement);
    fixture.detectChanges();
    submit(fixture.nativeElement);

    const request = http.expectOne(REGISTER_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Camilo',
      surname: 'Ternera',
      email: 'camilo@example.com',
      phoneNumber: '+57 300 000 0000',
      password: 'super-secret',
    });
  });

  it('does not submit when both passwords differ', () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    fill(fixture.nativeElement, { confirmPassword: 'something-else' });
    fixture.detectChanges();
    submit(fixture.nativeElement);
    fixture.detectChanges();

    http.expectNone(REGISTER_URL);
    expect(fixture.nativeElement.querySelector('[data-testid="password-mismatch"]')).toBeTruthy();
  });

  it('goes to the confirmation screen with the email when the envelope reports success', () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fill(fixture.nativeElement);
    fixture.detectChanges();
    submit(fixture.nativeElement);

    http.expectOne(REGISTER_URL).flush({
      data: null,
      isSuccess: true,
      messageKey: 'Usuario creado.',
      errors: [],
    });
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/confirm-email'], {
      state: { email: 'camilo@example.com' },
    });
  });

  it('maps a known backend error code to the English copy', () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    fill(fixture.nativeElement);
    fixture.detectChanges();
    submit(fixture.nativeElement);

    http.expectOne(REGISTER_URL).flush(
      {
        data: null,
        isSuccess: false,
        messageKey: 'Ha ocurrido un error.',
        errors: [{ code: 'USER_ALREADY_EXISTS', message: 'El correo ya esta registrado.' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="register-error"]').textContent).toContain(
      'That email is already registered.',
    );
  });

  it('falls back to the backend message when the code is unknown, even on a 200', () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    fill(fixture.nativeElement);
    fixture.detectChanges();
    submit(fixture.nativeElement);

    http.expectOne(REGISTER_URL).flush({
      data: null,
      isSuccess: false,
      messageKey: 'Ha ocurrido un error.',
      errors: [{ code: 'USER_SOMETHING_NEW', message: 'El telefono no es valido.' }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="register-error"]').textContent).toContain(
      'El telefono no es valido.',
    );
  });
});
