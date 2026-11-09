import { Routes } from '@angular/router';
import { authRoutes } from '@features/auth/auth.routes';
import { sessionGuard } from '@features/auth/presentation/guards/session.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  ...authRoutes,
  {
    // Las vistas privadas comparten el shell: barra lateral en desktop y menú en mobile.
    path: '',
    // Carga diferida: el login no paga el peso del shell ni de sus íconos.
    loadComponent: () => import('@shared/ui/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [sessionGuard],
    children: [
      {
        path: 'home',
        loadChildren: () => import('@features/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
      },
      {
        path: 'transactions',
        loadChildren: () => import('@features/transactions/transactions.routes').then((m) => m.transactionsRoutes),
      },
      {
        path: 'budgets',
        loadChildren: () => import('@features/budgets/budgets.routes').then((m) => m.budgetsRoutes),
      },
      {
        path: 'categories',
        loadChildren: () => import('@features/categories/categories.routes').then((m) => m.categoriesRoutes),
      },
      {
        path: 'accounts',
        loadChildren: () => import('@features/accounts/accounts.routes').then((m) => m.accountsRoutes),
      },
      {
        path: 'settings',
        loadChildren: () => import('@features/settings/settings.routes').then((m) => m.settingsRoutes),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
