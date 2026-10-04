import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { GENERIC_ERROR } from '@core/http/api-error';
import { ThemeService } from '@core/theme/theme.service';
import { ThemeSwitcherComponent } from '@shared/ui/theme-switcher.component';
import { RegisterUserUseCase } from '../../../application/register-user.use-case';
import { AuthError } from '../../../domain/auth-error';
import { PASSWORD_STRENGTH_LABELS, passwordStrength } from '../../../domain/password-strength';
import { passwordsMatch } from '../../validators/passwords-match.validator';

interface StrengthSegment {
  filled: boolean;
}

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, ThemeSwitcherComponent],
  templateUrl: './register-page.component.html',
  styleUrls: ['./register-page.component.css'],
})
export class RegisterPageComponent {
    private readonly registerUser = inject(RegisterUserUseCase);
    private readonly formBuilder = inject(NonNullableFormBuilder);
    private readonly themeService = inject(ThemeService);

    protected readonly theme = this.themeService.theme;
    protected readonly showPassword = signal(false);
    protected readonly isSubmitting = signal(false);
    protected readonly isRegistered = signal(false);
    protected readonly registerError = signal('');

    protected readonly registerForm = this.formBuilder.group(
      {
        name: ['', Validators.required],
        surname: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phoneNumber: ['', Validators.required],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
        acceptTerms: [false, Validators.requiredTrue],
      },
      { validators: passwordsMatch },
    );

    private readonly password = toSignal(this.registerForm.controls.password.valueChanges, {
      initialValue: '',
    });

    protected readonly strength = computed(() => passwordStrength(this.password()));

    protected readonly strengthLabel = computed(() => PASSWORD_STRENGTH_LABELS[this.strength()]);

    protected readonly strengthSegments = computed<StrengthSegment[]>(() =>
      [0, 1, 2].map((index) => ({ filled: index < this.strength() })),
    );

    protected get passwordMismatch(): boolean {
      const confirmPassword = this.registerForm.controls.confirmPassword;
      return confirmPassword.touched && this.registerForm.hasError('passwordMismatch');
    }

    protected togglePassword(): void {
      this.showPassword.update((visible) => !visible);
    }

    protected submit(): void {
      this.registerError.set('');

      if (this.registerForm.invalid) {
        this.registerForm.markAllAsTouched();
        return;
      }

      const { confirmPassword, acceptTerms, ...request } = this.registerForm.getRawValue();

      this.isSubmitting.set(true);
      this.registerUser
        .execute(request)
        .pipe(finalize(() => this.isSubmitting.set(false)))
        .subscribe({
          next: () => this.isRegistered.set(true),
          error: (error: unknown) =>
            this.registerError.set(error instanceof AuthError ? error.message : GENERIC_ERROR),
        });
    }
}
