import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Navigation, provideRouter, Router } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { environment } from '@env/environment';
import { provideAuth } from '../../../auth.providers';
import { ConfirmEmailPageComponent } from './confirm-email-page.component';

const RESEND = `${environment.apiUrl}/api/v1/User/confirm/resend`;
const EMAIL = 'first@example.com';
const SERVER_NOW = Date.parse('2026-11-27T12:00:00Z');

describe('email-verification independent review adjudication', () => {
  let fixture: ComponentFixture<ConfirmEmailPageComponent> | undefined;
  let http: HttpTestingController;

  beforeEach(async () => {
    fixture = undefined;
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(SERVER_NOW);
    // Leave Angular scheduling real; control only the component's periodic clock.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await TestBed.configureTestingModule({
      imports: [ConfirmEmailPageComponent, translocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAuth(),
        provideRouter([]),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    http.verify();
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

  function button(): HTMLButtonElement {
    return fixture!.nativeElement.querySelector('[data-testid="resend"]');
  }

  function rejectResend(code: string, data?: Record<string, unknown>) {
    http.expectOne(RESEND).flush({
      isSuccess: false,
      data: null,
      errors: [{ code, message: 'Backend failure', data }],
    }, { status: 400, statusText: 'Bad Request' });
  }

  async function tick(deviceNow: number) {
    vi.mocked(Date.now).mockReturnValue(deviceNow);
    vi.advanceTimersByTime(1000);
    await fixture!.whenStable();
  }

  it('J1 keeps focus in the email field while the user types the first character', async () => {
    await create();
    const email = fixture!.nativeElement.querySelector('[data-testid="email"]') as HTMLInputElement;
    email.focus();
    expect(document.activeElement).toBe(email);
    email.value = 'u';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture!.whenStable();
    expect(document.activeElement).toBe(email);
  });

  it('J2 allows a resend after the server cooldown despite a device clock one hour behind', async () => {
    const skew = 60 * 60 * 1000;
    vi.mocked(Date.now).mockReturnValue(SERVER_NOW - skew);
    await create({
      email: EMAIL,
      expiresAt: '2026-11-27T12:10:00Z',
      resendAvailableAt: '2026-11-27T12:01:00Z',
    });
    expect(button().disabled).toBe(true);
    await tick(SERVER_NOW - skew + 59_000);
    expect(button().disabled).toBe(true);
    await tick(SERVER_NOW - skew + 60_000);
    expect(button().disabled).toBe(false);
    // Two minutes elapsed on both clocks: the server now permits a resend.
    await tick(SERVER_NOW - skew + 120_000);
    expect(button().disabled).toBe(false);
    button().click();
    http.expectOne(RESEND).flush({ isSuccess: true });
  });

  it('persists the bounded resend wait across recreation and focuses the new code only after resend', async () => {
    const deviceNow = SERVER_NOW - 60 * 60 * 1000;
    vi.mocked(Date.now).mockReturnValue(deviceNow);
    await create({ email: EMAIL });
    button().click();
    http.expectOne(RESEND).flush({
      isSuccess: true,
      data: {
        email: EMAIL,
        expiresAt: '2026-11-27T12:10:00Z',
        resendAvailableAt: '2026-11-27T12:01:00Z',
      },
    });
    await fixture!.whenStable();
    expect(document.activeElement).toBe(fixture!.nativeElement.querySelector('[data-testid="digit-0"]'));
    expect(button().disabled).toBe(true);
    const state = TestBed.inject(Location).getState() as Record<string, unknown>;
    expect(state).toMatchObject({
      email: EMAIL,
      resendAvailableAt: new Date(deviceNow + 60_000).toISOString(),
    });
    fixture!.destroy();
    vi.mocked(Date.now).mockReturnValue(deviceNow + 30_000);
    await create(state);
    await tick(deviceNow + 59_000);
    expect(button().disabled).toBe(true);
    await tick(deviceNow + 60_000);
    expect(button().disabled).toBe(false);
  });

  it('checks the real resend method, selected email and browser time zone', async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await create({ email: EMAIL });
    button().click();
    const request = http.expectOne(RESEND);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: EMAIL, timeZone });
    request.flush({ isSuccess: true });
    await fixture!.whenStable();
    expect(fixture!.nativeElement.querySelector('[data-testid="code-resent"]')).not.toBeNull();
  });

  it('unlocks resend at the deadline, but not one second earlier, with a synchronized clock', async () => {
    await create({ email: EMAIL, resendAvailableAt: '2026-11-27T12:01:00Z' });
    expect(button().disabled).toBe(true);
    await tick(SERVER_NOW + 59_000);
    expect(button().disabled).toBe(true);
    await tick(SERVER_NOW + 60_000);
    expect(button().disabled).toBe(false);
    button().click();
    http.expectOne(RESEND).flush({ isSuccess: true });
  });

  it.each([
    ['server deadline', '2026-11-27T12:02:00Z', 120],
    ['missing deadline', undefined, 60],
    ['invalid deadline', 'not-a-date', 60],
  ] as const)('honors and persists a too-soon response with %s', async (_, deadline, seconds) => {
    await create({ email: EMAIL });
    button().click();
    rejectResend('VERIFICATION_RESEND_TOO_SOON', { resendAvailableAt: deadline });
    await fixture!.whenStable();
    expect(button().disabled).toBe(true);
    expect(fixture!.nativeElement.querySelector('[data-testid="confirm-error"]')).not.toBeNull();
    expect(TestBed.inject(Location).getState()).toMatchObject({
      email: EMAIL,
      resendAvailableAt: new Date(SERVER_NOW + seconds * 1000).toISOString(),
    });
    await tick(SERVER_NOW + (seconds - 1) * 1000);
    expect(button().disabled).toBe(true);
    await tick(SERVER_NOW + seconds * 1000);
    expect(button().disabled).toBe(false);
  });

  it('navigates to login when resend reports an already confirmed account', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await create({ email: EMAIL });
    button().click();
    rejectResend('USER_EMAIL_ALREADY_REGISTERED');
    await fixture!.whenStable();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login'], { state: { emailConfirmed: true } });
  });

  it('shows a missing-registration error without leaving resend stuck in progress', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await create({ email: EMAIL });
    button().click();
    rejectResend('VERIFICATION_REGISTRATION_NOT_FOUND');
    await fixture!.whenStable();
    expect(fixture!.nativeElement.querySelector('[data-testid="confirm-error"]').textContent.trim()).not.toBe('');
    expect(navigate).not.toHaveBeenCalled();
    expect(button().disabled).toBe(false);
    button().click();
    http.expectOne(RESEND).flush({ isSuccess: true });
  });
});
