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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import {
  CONFIRMATION_CODE_LENGTH,
  isConfirmationCodeComplete,
  onlyDigits,
} from '../../../domain/confirmation-code';
import { ConfirmEmailUseCase } from '../../../application/confirm-email.use-case';
import { ResendVerificationCodeUseCase } from '../../../application/resend-verification-code.use-case';
import { AuthError } from '../../../domain/auth-error';
import { VerificationWindow, parseInstant, secondsUntil } from '../../../domain/verification-window';
import { confirmationCodeComplete } from '../../validators/confirmation-code.validator';

/**
 * Espera local entre reenvíos cuando el backend no informa `resendAvailableAt`.
 * Coincide con la del backend, que sigue siendo quien la hace cumplir.
 */
const FALLBACK_RESEND_SECONDS = 60;

/** Lo que el registro deja en el router state al navegar a esta vista. */
interface ConfirmEmailNavigationState {
  email?: unknown;
  expiresAt?: unknown;
  resendAvailableAt?: unknown;
}

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

@Component({
  selector: 'app-confirm-email-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './confirm-email-page.component.html',
  styleUrls: ['./confirm-email-page.component.css'],
})
export class ConfirmEmailPageComponent {
  private readonly confirmEmail = inject(ConfirmEmailUseCase);
  private readonly resendCode = inject(ResendVerificationCodeUseCase);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  /**
   * The address and the code deadlines come through router state, never a query param:
   * the address is personal data and does not belong in the URL or the browser history.
   */
  private readonly navigationState = ((): ConfirmEmailNavigationState => {
    const router = inject(Router);
    // `lastSuccessfulNavigation` is a signal in Angular 21; it covers a refresh of this route.
    const previous = router.lastSuccessfulNavigation;
    const navigation =
      router.getCurrentNavigation() ?? (typeof previous === 'function' ? previous() : previous);

    return (navigation?.extras.state as ConfirmEmailNavigationState | undefined) ?? {};
  })();

  protected readonly navigationEmail = asText(this.navigationState.email);

  protected readonly theme = this.themeService.theme;
  protected readonly digitInputs = viewChildren<ElementRef<HTMLInputElement>>('digitInput');

  /** Without an address in the navigation the view has to ask for one (direct visit, reload). */
  protected readonly hasNavigationEmail = this.navigationEmail !== '';

  protected readonly isSubmitting = signal(false);
  protected readonly confirmError = signal('');

  protected readonly codeForm = this.formBuilder.group(
    {
      email: [this.navigationEmail, [Validators.required, Validators.email]],
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

  /** Reloj de la vista: las cuentas regresivas se calculan contra fechas, no restando segundos. */
  private readonly now = signal(Date.now());

  /** Sin plazo conocido (recarga, visita directa) no hay cuenta regresiva y se puede reenviar ya. */
  private readonly expiresAt = signal(parseInstant(asText(this.navigationState.expiresAt)));
  private readonly resendAvailableAt = signal(parseInstant(asText(this.navigationState.resendAvailableAt)));

  /** El backend invalidó el código (venció o se agotaron los intentos) antes de que venciera aquí. */
  private readonly codeRejected = signal(false);

  protected readonly isResending = signal(false);
  /** Se acaba de enviar un código nuevo; la plantilla muestra el aviso. */
  protected readonly codeResent = signal(false);

  private readonly secondsToResend = computed(() => secondsUntil(this.resendAvailableAt(), this.now()));
  private readonly secondsToExpiry = computed(() => secondsUntil(this.expiresAt(), this.now()));

  protected readonly hasDeadline = computed(() => this.expiresAt() !== null);
  protected readonly isExpired = computed(() => this.hasDeadline() && this.secondsToExpiry() === 0);
  /** El código actual ya no puede confirmar la cuenta: solo queda pedir otro. */
  protected readonly isCodeUnusable = computed(() => this.isExpired() || this.codeRejected());

  protected readonly canResend = computed(() => this.secondsToResend() === 0 && !this.isResending());
  protected readonly countdown = computed(() => countdown(this.secondsToResend()));
  protected readonly expiryCountdown = computed(() => countdown(this.secondsToExpiry()));

  /** Hora local de vencimiento en el idioma activo, por ejemplo `5:18 p. m.` o `5:18 PM`. */
  protected readonly expiryClock = computed(() => {
    const expiresAt = this.expiresAt();

    return expiresAt
      ? new Intl.DateTimeFormat(this.languageService.language(), { hour: 'numeric', minute: '2-digit' }).format(
          expiresAt,
        )
      : '';
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);

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

    const email = this.codeForm.controls.email;

    if (email.invalid) {
      email.markAsTouched();
      return;
    }

    this.confirmError.set('');
    this.codeResent.set(false);
    this.isResending.set(true);
    this.resendCode
      .execute(email.value)
      .pipe(finalize(() => this.isResending.set(false)))
      .subscribe({
        next: (issued) => {
          this.applyWindow(issued);
          this.codeRejected.set(false);
          this.codeResent.set(true);
          this.clearCode();
        },
        error: (error: unknown) => this.onResendError(error),
      });
  }

  protected submit(): void {
    this.confirmError.set('');
    this.codeResent.set(false);
    this.codeForm.markAllAsTouched();

    if (this.codeForm.invalid || this.isCodeUnusable()) {
      return;
    }

    this.isSubmitting.set(true);
    this.confirmEmail
      .execute({ email: this.codeForm.controls.email.value, code: this.code() })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/login'], { state: { emailConfirmed: true } }),
        error: (error: unknown) => {
          // Un código vencido o bloqueado por intentos no vuelve a servir: solo queda reenviar.
          if (error instanceof AuthError && (error.reason === 'codeExpired' || error.reason === 'attemptsExceeded')) {
            this.codeRejected.set(true);
          }

          this.displayError(error);
        },
      });
  }

  /** Toma los plazos del código recién enviado; sin espera informada aplica la local. */
  private applyWindow(issued: VerificationWindow): void {
    this.expiresAt.set(parseInstant(issued.expiresAt));
    this.resendAvailableAt.set(parseInstant(issued.resendAvailableAt) ?? this.fallbackResendAt());
  }

  private onResendError(error: unknown): void {
    if (error instanceof AuthError && error.reason === 'alreadyRegistered') {
      // La cuenta ya quedó confirmada (por ejemplo en otra pestaña): solo falta iniciar sesión.
      void this.router.navigate(['/login'], { state: { emailConfirmed: true } });
      return;
    }

    if (error instanceof AuthError && error.reason === 'resendTooSoon') {
      this.resendAvailableAt.set(parseInstant(error.resendAvailableAt) ?? this.fallbackResendAt());
    }

    this.displayError(error);
  }

  private displayError(error: unknown): void {
    this.confirmError.set(error instanceof AuthError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY));
  }

  private fallbackResendAt(): Date {
    return new Date(Date.now() + FALLBACK_RESEND_SECONDS * 1000);
  }

  /** Vacía las cajas para el código nuevo y deja el foco en la primera. */
  private clearCode(): void {
    this.digits.controls.forEach((digit) => digit.setValue(''));
    this.digits.markAsUntouched();
    this.focusAt(0);
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
