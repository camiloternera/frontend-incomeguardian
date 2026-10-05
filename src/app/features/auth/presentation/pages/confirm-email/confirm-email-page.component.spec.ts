import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Navigation, Router, provideRouter } from '@angular/router';
import { ConfirmEmailPageComponent } from './confirm-email-page.component';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { provideAuth } from '../../../auth.providers';

const CONFIRM_URL = 'https://localhost:7151/api/v1/User/confirm';

function digit(element: HTMLElement, index: number): HTMLInputElement {
  return element.querySelector(`[data-testid="digit-${index}"]`) as HTMLInputElement;
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function paste(input: HTMLInputElement, text: string): void {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
    clipboardData: { getData: () => string };
  };
  event.clipboardData = { getData: () => text };
  input.dispatchEvent(event);
}

function fillCode(element: HTMLElement, code: string): void {
  for (let index = 0; index < code.length; index++) {
    type(digit(element, index), code.charAt(index));
  }
}

function submit(element: HTMLElement): void {
  (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
}

function withNavigationEmail(email: string): void {
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'getCurrentNavigation').mockReturnValue({
    extras: { state: { email } },
  } as unknown as Navigation);
}

describe('ConfirmEmailPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ConfirmEmailPageComponent, translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAuth()],
    }).compileComponents();
  });

  it('renders six digit boxes and keeps verify disabled until the code is complete', () => {
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    const boxes = fixture.nativeElement.querySelectorAll('[data-testid^="digit-"]');
    expect(boxes.length).toBe(6);

    const verify = fixture.nativeElement.querySelector('[data-testid="verify"]') as HTMLButtonElement;
    expect(verify.disabled).toBe(true);

    for (let index = 0; index < 6; index++) {
      type(digit(fixture.nativeElement, index), String(index + 1));
    }
    fixture.detectChanges();

    expect(verify.disabled).toBe(false);
  });

  it('moves focus forward as digits are typed', () => {
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    type(digit(fixture.nativeElement, 0), '4');
    expect(document.activeElement).toBe(digit(fixture.nativeElement, 1));

    type(digit(fixture.nativeElement, 1), '7');
    expect(document.activeElement).toBe(digit(fixture.nativeElement, 2));
  });

  it('rejects anything that is not a digit', () => {
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    const first = digit(fixture.nativeElement, 0);
    type(first, 'a');
    fixture.detectChanges();

    expect(first.value).toBe('');
    expect(document.activeElement).not.toBe(digit(fixture.nativeElement, 1));
  });

  it('steps back when backspace is pressed on an empty box', () => {
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    type(digit(fixture.nativeElement, 0), '4');
    const second = digit(fixture.nativeElement, 1);
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    fixture.detectChanges();

    expect(document.activeElement).toBe(digit(fixture.nativeElement, 0));
    expect(digit(fixture.nativeElement, 0).value).toBe('');
  });

  it('spreads a pasted code across every box', () => {
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    paste(digit(fixture.nativeElement, 0), '123456');
    fixture.detectChanges();

    expect(
      Array.from({ length: 6 }, (_, index) => digit(fixture.nativeElement, index).value).join(''),
    ).toBe('123456');
    expect(
      (fixture.nativeElement.querySelector('[data-testid="verify"]') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('shows the email carried by the navigation', () => {
    withNavigationEmail('camilo@example.com');
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="confirm-email-address"]').textContent,
    ).toContain('camilo@example.com');
  });

  it('falls back to neutral copy when it is opened without an email', () => {
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="confirm-email-address"]').textContent,
    ).toContain('the email you signed up with');
  });

  it('asks for the address when it is opened without one', () => {
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="email"]')).toBeTruthy();
  });

  it('hides the address field when the navigation carried one', () => {
    withNavigationEmail('camilo@example.com');
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="email"]')).toBeNull();
  });

  it('posts the address and the code, then sends the user to sign in', () => {
    withNavigationEmail('camilo@example.com');
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fillCode(fixture.nativeElement, '123456');
    fixture.detectChanges();
    submit(fixture.nativeElement);

    const request = http.expectOne(CONFIRM_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'camilo@example.com', code: '123456' });

    request.flush(
      {
        data: {
          id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          state: true,
          name: 'Camilo',
          surname: 'Ternera',
          email: 'camilo@example.com',
          phoneNumber: '3000000000',
        },
        isSuccess: true,
        message: 'Usuario confirmado.',
        errors: [],
      },
      { status: 201, statusText: 'Created' },
    );

    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { state: { emailConfirmed: true } });
  });

  it('shows the backend message when the code is rejected', () => {
    withNavigationEmail('camilo@example.com');
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    fillCode(fixture.nativeElement, '999999');
    fixture.detectChanges();
    submit(fixture.nativeElement);

    http.expectOne(CONFIRM_URL).flush(
      {
        data: null,
        isSuccess: false,
        message: 'Ha ocurrido un error.',
        errors: [{ code: 'USER_CODE_INVALID', message: 'El codigo no es valido.' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="confirm-error"]').textContent).toContain(
      'El codigo no es valido.',
    );
  });

  it('does not call the backend without an address', () => {
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    fillCode(fixture.nativeElement, '123456');
    fixture.detectChanges();
    submit(fixture.nativeElement);

    http.expectNone(CONFIRM_URL);
  });

  it('maps the real rejection code to the English copy', () => {
    withNavigationEmail('camilo@example.com');
    const fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    fillCode(fixture.nativeElement, '123456');
    fixture.detectChanges();
    submit(fixture.nativeElement);

    // Envelope captured from the running backend.
    http.expectOne(CONFIRM_URL).flush(
      {
        data: null,
        isSuccess: false,
        message: 'Ha ocurrido un error.',
        errors: [
          {
            code: 'VERIFICATION_CODE_EXPIRED',
            message: 'El codigo de verificacion no existe o expiro.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="confirm-error"]').textContent).toContain(
      'That code is wrong or has expired.',
    );
  });
});
