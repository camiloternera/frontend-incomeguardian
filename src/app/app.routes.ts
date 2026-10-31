import { Routes } from '@angular/router';
import { authRoutes } from '@features/auth/auth.routes';
import { sessionGuard } from '@features/auth/presentation/guards/session.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  ...authRoutes,
  {
    path: 'home',
    canActivate: [sessionGuard],
    loadChildren: () => import('@features/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
  },
  {
    path: 'categories',
    canActivate: [sessionGuard],
    loadChildren: () => import('@features/categories/categories.routes').then((m) => m.categoriesRoutes),
  },
  {
    path: 'settings',
    canActivate: [sessionGuard],
    loadChildren: () => import('@features/settings/settings.routes').then((m) => m.settingsRoutes),
  },
  { path: '**', redirectTo: 'login' },
];
