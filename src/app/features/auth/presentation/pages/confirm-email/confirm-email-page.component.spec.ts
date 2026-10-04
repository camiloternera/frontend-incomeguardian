import { TestBed } from '@angular/core/testing';
import { Navigation, Router, provideRouter } from '@angular/router';
import { ConfirmEmailPageComponent } from './confirm-email-page.component';

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
      imports: [ConfirmEmailPageComponent],
      providers: [provideRouter([])],
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
});
