import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Navigation, provideRouter, Router } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { environment } from '@env/environment';
import { provideAuth } from '../../../auth.providers';
import { ConfirmEmailPageComponent } from './confirm-email-page.component';

const CONFIRM = `${environment.apiUrl}/api/v1/User/confirm`;
const RESEND = `${CONFIRM}/resend`;
const EMAIL = 'first@example.com';
const NOW = Date.parse('2026-11-27T12:00:00Z');

describe('email-verification branch regressions', () => {
  let fixture: ComponentFixture<ConfirmEmailPageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await TestBed.configureTestingModule({
      imports: [ConfirmEmailPageComponent, translocoTesting()],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideAuth(),
        provideRouter([
          { path: 'confirm-email', component: ConfirmEmailPageComponent },
          { path: 'login', children: [] },
        ]),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  async function create(state?: Record<string, unknown>) {
    if (state) {
      vi.spyOn(TestBed.inject(Router), 'getCurrentNavigation').mockReturnValue({
        extras: { state },
      } as unknown as Navigation);
    }
    fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    await fixture.whenStable();
  }

  function input(id: string, value: string) {
    const element = fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function fill(email?: string) {
    if (email) input('email', email);
    for (let i = 0; i < 6; i++) input(`digit-${i}`, String(i + 1));
    await fixture.whenStable();
  }

  function submit() {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
  }

  function button(id: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  }

  function expired(request: ReturnType<HttpTestingController['expectOne']>) {
    request.flush({
      isSuccess: false, data: null,
      errors: [{ code: 'VERIFICATION_CODE_ATTEMPTS_EXCEEDED', message: 'Attempts exceeded' }],
    }, { status: 400, statusText: 'Bad Request' });
  }

  function resendSuccess(expiresAt = '2026-11-27T12:20:00Z') {
    http.expectOne(RESEND).flush({
      isSuccess: true,
      data: { email: EMAIL, expiresAt, resendAvailableAt: '2026-11-27T12:01:00Z' },
      errors: [],
    });
  }

  it('does not let an old confirmation error invalidate a newly issued code', async () => {
    await create({ email: EMAIL });
    await fill();
    submit();
    const previous = http.expectOne(CONFIRM);
    await fixture.whenStable();
    // Either serialize operations, or ignore stale responses if they overlap.
    if (button('resend').disabled) {
      expired(previous);
      await fixture.whenStable();
      button('resend').click();
      resendSuccess();
    } else {
      button('resend').click();
      resendSuccess();
      expired(previous);
    }
    await fill();
    expect(button('verify').disabled).toBe(false);
    submit();
    http.expectOne(CONFIRM).flush({ isSuccess: true });
  });

  it('does not carry an attempts lock from one email address to another', async () => {
    await create();
    await fill(EMAIL);
    submit();
    expired(http.expectOne(CONFIRM));
    await fixture.whenStable();
    expect(button('verify').disabled).toBe(true);
    await fill('second@example.com');
    expect(button('verify').disabled).toBe(false);
    submit();
    const request = http.expectOne(CONFIRM);
    expect(request.request.body.email).toBe('second@example.com');
    request.flush({ isSuccess: true });
  });

  it('lets the server validate a live code when the device clock is ahead', async () => {
    // The server issued the code at 12:00, valid until 12:10.
    vi.mocked(Date.now).mockReturnValue(Date.parse('2026-11-27T12:15:00Z'));
    await create({ email: EMAIL, expiresAt: '2026-11-27T12:10:00Z' });
    await fill();
    expect(button('verify').disabled).toBe(false);
    submit();
    http.expectOne(CONFIRM).flush({ isSuccess: true });
  });

  it('does not restore the previous code deadline when the view is recreated after resend', async () => {
    const router = TestBed.inject(Router);
    // Real navigation: its state is what the component restores on a new instance.
    await router.navigate(['/confirm-email'], {
      state: {
        email: EMAIL,
        expiresAt: '2026-11-27T12:05:00Z',
        resendAvailableAt: '2026-11-27T11:59:00Z',
      },
    });
    await create();
    button('resend').click();
    resendSuccess('2026-11-27T12:20:00Z');
    await fixture.whenStable();
    expect(TestBed.inject(Location).getState()).toMatchObject({
      email: EMAIL,
      expiresAt: '2026-11-27T12:20:00.000Z',
      resendAvailableAt: '2026-11-27T12:01:00.000Z',
    });
    await fill();
    expect(button('verify').disabled).toBe(false);
    fixture.destroy();
    vi.mocked(Date.now).mockReturnValue(Date.parse('2026-11-27T12:06:00Z'));
    await create();
    await fill();
    expect(fixture.nativeElement.querySelector('[data-testid="code-expiry"]').textContent).toContain('14:00');
    expect(button('verify').disabled).toBe(false);
    submit();
    http.expectOne(CONFIRM).flush({ isSuccess: true });
  });

  it('ignores an old email rejection that arrives after the email is edited', async () => {
    await create();
    await fill(EMAIL);
    submit();
    const previous = http.expectOne(CONFIRM);
    await fill('second@example.com');
    expired(previous);
    await fixture.whenStable();
    expect(button('verify').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-error"]')).toBeNull();
    submit();
    const current = http.expectOne(CONFIRM);
    expect(current.request.body).toEqual({ email: 'second@example.com', code: '123456' });
    current.flush({ isSuccess: true });
  });

  it('does not navigate on a confirmation success belonging to a different email', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await create();
    await fill(EMAIL);
    submit();
    const previous = http.expectOne(CONFIRM);
    await fill('second@example.com');
    previous.flush({ isSuccess: true });
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();
    expect(button('verify').disabled).toBe(false);
  });

  it('ignores a resend response for an email that is no longer selected', async () => {
    await create();
    await fill(EMAIL);
    button('resend').click();
    await fill('second@example.com');
    resendSuccess();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="code-resent"]')).toBeNull();
    expect(button('verify').disabled).toBe(false);
    expect(button('resend').disabled).toBe(false);
    submit();
    const current = http.expectOne(CONFIRM);
    expect(current.request.body).toEqual({ email: 'second@example.com', code: '123456' });
    current.flush({ isSuccess: true });
  });

  it('serializes verification and resend requests including repeated form submits', async () => {
    await create({ email: EMAIL });
    await fill();
    submit();
    const confirmation = http.expectOne(CONFIRM);
    submit();
    http.expectNone(CONFIRM);
    await fixture.whenStable();
    expect(button('resend').disabled).toBe(true);
    button('resend').click();
    http.expectNone(RESEND);
    expired(confirmation);
    await fixture.whenStable();
    button('resend').click();
    const resend = http.expectOne(RESEND);
    await fixture.whenStable();
    expect(button('verify').disabled).toBe(true);
    submit();
    http.expectNone(CONFIRM);
    resend.flush({
      isSuccess: true,
      data: { email: EMAIL, expiresAt: '2026-11-27T12:20:00Z', resendAvailableAt: '' },
    });
    await fill();
    expect(button('verify').disabled).toBe(false);
  });

  it.each([
    ['en-US', 'According to your device clock'],
    ['es-CO', 'Según el reloj de tu dispositivo'],
  ] as const)('shows an advisory expiry message in %s without blocking confirmation', async (language, message) => {
    TestBed.inject(LanguageService).setLanguage(language);
    await create({ email: EMAIL, expiresAt: '2026-11-27T11:59:00Z' });
    await fill();
    expect(fixture.nativeElement.querySelector('[data-testid="code-expiry"]').textContent).toContain(message);
    expect(button('verify').disabled).toBe(false);
  });
});
