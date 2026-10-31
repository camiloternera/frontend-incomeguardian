import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideAccounts } from './accounts.providers';
import { AccountListPageComponent } from './presentation/pages/account-list/account-list-page.component';

export const accountsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('accounts'), provideAccounts()],
    children: [
      { path: '', component: AccountListPageComponent },
      {
        path: 'new',
        loadComponent: () =>
          import('./presentation/pages/account-form/account-form-page.component').then((m) => m.AccountFormPageComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./presentation/pages/account-form/account-form-page.component').then((m) => m.AccountFormPageComponent),
      },
    ],
  },
];
