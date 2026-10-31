import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPageComponent } from './login-page.component';
import { routes } from '../../../../../app.routes';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { provideAuth } from '../../../auth.providers';

describe('LoginPageComponent', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent, translocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        provideAuth(),
      ],
    }).compileComponents();
  });

  it('follows the active theme without offering a switcher', () => {
    TestBed.inject(ThemeService).setTheme('paper');
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="login-shell"]').dataset.theme).toBe('paper');
    // El tema y el idioma se cambian solo desde Ajustes.
    expect(fixture.nativeElement.querySelector('[aria-pressed]')).toBeNull();
  });

  it('renders in the active language', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    TestBed.tick();
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#login-title').textContent).toContain('Retoma donde lo dejaste.');
    expect(document.documentElement.lang).toBe('es-CO');
  });

  it('toggles password visibility', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const password = fixture.nativeElement.querySelector('[data-testid="password"]') as HTMLInputElement;
    const toggle = fixture.nativeElement.querySelector('[data-testid="password-toggle"]') as HTMLButtonElement;

    expect(password.type).toBe('password');
    toggle.click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
  });

  it('submits credentials and navigates after a successful login', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();

    const email = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'secret';
    password.dispatchEvent(new Event('input'));
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const request = http.expectOne('https://localhost:7151/api/v1/User/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'user@example.com', password: 'secret' });

    request.flush({
      data: {
        userId: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-08-09T12:00:00Z',
        theme: 'paper',
        language: 'es-CO',
      },
      isSuccess: true,
      message: 'ok',
      errors: [],
    });

    expect(navigateSpy).toHaveBeenCalledWith('/home');
    expect(JSON.parse(sessionStorage.getItem('income-guardian.session') ?? '{}').accessToken).toBe('access-token');
    // Las preferencias guardadas en la cuenta se aplican al entrar.
    expect(TestBed.inject(ThemeService).theme()).toBe('paper');
    expect(TestBed.inject(LanguageService).language()).toBe('es-CO');
  });

  it('shows an error when the login request fails', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const email = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'wrong-password';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const request = http.expectOne('https://localhost:7151/api/v1/User/login');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Unable to sign in');
  });
});
