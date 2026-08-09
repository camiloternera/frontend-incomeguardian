import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

type ThemeName = 'forest' | 'paper' | 'noir';

interface ThemeOption {
  id: ThemeName;
  label: string;
  number: string;
}

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  protected readonly theme = signal<ThemeName>('forest');
  protected readonly showPassword = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly loginError = signal('');

  protected readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly themes: ThemeOption[] = [
    { id: 'forest', label: 'Forest', number: '01' },
    { id: 'paper', label: 'Paper', number: '02' },
    { id: 'noir', label: 'Noir', number: '03' },
  ];

  protected setTheme(theme: ThemeName): void {
    this.theme.set(theme);
  }

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
    this.authService.login(this.loginForm.getRawValue()).pipe(
      finalize(() => this.isSubmitting.set(false)),
    ).subscribe({
      next: () => void this.router.navigateByUrl('/home'),
      error: () => this.loginError.set('Unable to sign in. Check your credentials and try again.'),
    });
  }
}
