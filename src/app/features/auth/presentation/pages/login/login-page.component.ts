import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { finalize } from 'rxjs';
import { ThemeService } from '@core/theme/theme.service';
import { LanguageSwitcherComponent } from '@shared/ui/language-switcher.component';
import { ThemeSwitcherComponent } from '@shared/ui/theme-switcher.component';
import { LoginUseCase } from '../../../application/login.use-case';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, LanguageSwitcherComponent, ThemeSwitcherComponent, LucideEye, LucideEyeOff],
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css'],
})

export class LoginPageComponent {
  private readonly login = inject(LoginUseCase);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly transloco = inject(TranslocoService);

  /** Set when the user lands here straight after confirming their email. */
  protected readonly emailConfirmed = ((): boolean => {
    const previous = this.router.lastSuccessfulNavigation;
    const navigation =
      this.router.getCurrentNavigation() ?? (typeof previous === 'function' ? previous() : previous);
    const state = navigation?.extras.state as { emailConfirmed?: boolean } | undefined;

    return state?.emailConfirmed === true;
  })();

  protected readonly theme = this.themeService.theme;
  protected readonly showPassword = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly loginError = signal('');

  protected readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    this.loginError.set('');

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.login.execute(this.loginForm.getRawValue()).pipe(
      finalize(() => this.isSubmitting.set(false)),
    ).subscribe({
      next: () => void this.router.navigateByUrl('/home'),
      error: () => this.loginError.set(this.transloco.translate('auth.login.error')),
    });
  }
}
