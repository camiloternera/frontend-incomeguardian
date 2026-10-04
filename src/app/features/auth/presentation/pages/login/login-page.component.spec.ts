import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPageComponent } from './login-page.component';
import { routes } from '../../../../../app.routes';
import { provideAuth } from '../../../auth.providers';

describe('LoginPageComponent', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        provideAuth(),
      ],
    }).compileComponents();
  });

  it('changes the active visual theme', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const paperButton = fixture.nativeElement.querySelector('[aria-label="Use Paper theme"]') as HTMLButtonElement;
    paperButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="login-shell"]').dataset.theme).toBe('paper');

    const noirButton = fixture.nativeElement.querySelector('[aria-label="Use Noir theme"]') as HTMLButtonElement;
    noirButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="login-shell"]').dataset.theme).toBe('noir');
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
      UserId: 'user-1',
      Email: 'user@example.com',
      Name: 'Test User',
      AccessToken: 'access-token',
      RefreshToken: 'refresh-token',
      ExpiresAt: '2026-08-09T12:00:00Z',
    });

    expect(navigateSpy).toHaveBeenCalledWith('/home');
    expect(JSON.parse(sessionStorage.getItem('income-guardian.session') ?? '{}').accessToken).toBe('access-token');
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
