import { Routes } from '@angular/router';
import { LoginPageComponent } from './presentation/pages/login/login-page.component';

export const authRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  {
    path: 'register',
    loadComponent: () =>
      import('./presentation/pages/register/register-page.component').then((m) => m.RegisterPageComponent),
  },
];
