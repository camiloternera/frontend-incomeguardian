import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { LoginPageComponent } from './presentation/pages/login/login-page.component';

export const authRoutes: Routes = [
  {
    path: '',
    // Loads `public/i18n/auth/<lang>.json` only when an auth page is visited.
    providers: [provideTranslocoScope('auth')],
    children: [
      { path: 'login', component: LoginPageComponent },
      {
        path: 'register',
        loadComponent: () =>
          import('./presentation/pages/register/register-page.component').then((m) => m.RegisterPageComponent),
      },
      {
        path: 'confirm-email',
        loadComponent: () =>
          import('./presentation/pages/confirm-email/confirm-email-page.component').then(
            (m) => m.ConfirmEmailPageComponent,
          ),
      },
    ],
  },
];
