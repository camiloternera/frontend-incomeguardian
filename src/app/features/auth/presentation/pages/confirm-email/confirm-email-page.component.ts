import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ThemeService } from '@core/theme/theme.service';
import { ThemeSwitcherComponent } from '@shared/ui/theme-switcher.component';
import {
  CONFIRMATION_CODE_LENGTH,
  isConfirmationCodeComplete,
  onlyDigits,
} from '../../../domain/confirmation-code';
import { confirmationCodeComplete } from '../../validators/confirmation-code.validator';

const RESEND_SECONDS = 60;

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

@Component({
  selector: 'app-confirm-email-page',
  imports: [ReactiveFormsModule, RouterLink, ThemeSwitcherComponent],
  templateUrl: './confirm-email-page.component.html',
  styleUrls: ['./confirm-email-page.component.css'],
})
export class ConfirmEmailPageComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The address comes through router state, never a query param: it is personal
   * data and does not belong in the URL or the browser history.
   */
  private readonly navigationEmail = ((): string => {
    const router = inject(Router);
    // `lastSuccessfulNavigation` is a signal in Angular 21; it covers a refresh of this route.
    const previous = router.lastSuccessfulNavigation;
    const navigation =
      router.getCurrentNavigation() ?? (typeof previous === 'function' ? previous() : previous);
    const state = navigation?.extras.state as { email?: string } | undefined;

    return typeof state?.email === 'string' ? state.email : '';
  })();

  protected readonly theme = this.themeService.theme;
  protected readonly digitInputs = viewChildren<ElementRef<HTMLInputElement>>('digitInput');

  protected readonly email = this.navigationEmail;
  protected readonly emailLabel = this.navigationEmail || 'the email you signed up with';

  protected readonly codeForm = this.formBuilder.group(
    {
      code: this.formBuilder.array(
        Array.from({ length: CONFIRMATION_CODE_LENGTH }, () => this.formBuilder.control('')),
      ),
    },
    { validators: confirmationCodeComplete },
  );

  private readonly digitValues = toSignal(this.codeForm.controls.code.valueChanges, {
    initialValue: [] as string[],
  });

  protected readonly code = computed(() => this.digitValues().join(''));
  protected readonly isComplete = computed(() => isConfirmationCodeComplete(this.code()));

  protected readonly secondsLeft = signal(RESEND_SECONDS);
  protected readonly canResend = computed(() => this.secondsLeft() === 0);
  protected readonly resendLabel = computed(() =>
    this.canResend() ? 'Resend email' : `Resend in ${countdown(this.secondsLeft())}`,
  );

  constructor() {
    const timer = setInterval(() => {
      this.secondsLeft.update((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);

    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected get digits() {
    return this.codeForm.controls.code;
  }

  protected get showError(): boolean {
    return this.digits.touched && !this.isComplete();
  }

  protected onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const typed = onlyDigits(input.value);

    // A longer value means the browser dropped a whole code in (autofill, drag).
    if (typed.length > 1) {
      this.fillFrom(typed.length === CONFIRMATION_CODE_LENGTH ? 0 : index, typed);
      return;
    }

    this.digits.at(index).setValue(typed);
    // Keeps the box in sync when a rejected character left the DOM ahead of the control.
    input.value = typed;

    if (typed) {
      this.focusAt(index + 1);
    }
  }

  protected onPaste(index: number, event: ClipboardEvent): void {
    const pasted = onlyDigits(event.clipboardData?.getData('text') ?? '');

    if (!pasted) {
      return;
    }

    event.preventDefault();
    this.fillFrom(pasted.length === CONFIRMATION_CODE_LENGTH ? 0 : index, pasted);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits.at(index).value && index > 0) {
      event.preventDefault();
      this.digits.at(index - 1).setValue('');
      this.focusAt(index - 1);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusAt(index - 1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusAt(index + 1);
    }
  }

  protected resend(): void {
    if (!this.canResend()) {
      return;
    }

    this.secondsLeft.set(RESEND_SECONDS);
    // TODO: send the code again once the backend exposes the endpoint.
  }

  protected submit(): void {
    this.digits.markAllAsTouched();

    if (this.codeForm.invalid) {
      return;
    }

    // TODO: hand the code to a ConfirmEmailUseCase once the backend endpoint exists.
  }

  private fillFrom(start: number, digits: string): void {
    let last = start;

    for (let offset = 0; offset < digits.length && start + offset < CONFIRMATION_CODE_LENGTH; offset++) {
      this.digits.at(start + offset).setValue(digits.charAt(offset));
      last = start + offset;
    }

    this.focusAt(last + 1);
  }

  private focusAt(index: number): void {
    const target = Math.min(Math.max(index, 0), CONFIRMATION_CODE_LENGTH - 1);
    const input = this.digitInputs()[target]?.nativeElement;

    input?.focus();
    input?.select();
  }
}
