import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideAccountTypes } from './account-types.providers';
import { AccountTypeListPageComponent } from './presentation/pages/account-type-list/account-type-list-page.component';

export const accountTypesRoutes: Routes = [
  {
    path: '',
    // Transloco expone el scope `account-types` con la clave `accountTypes`.
    providers: [provideTranslocoScope('account-types'), provideAccountTypes()],
    children: [
      { path: '', component: AccountTypeListPageComponent },
      {
        path: 'new',
        loadComponent: () =>
          import('./presentation/pages/account-type-form/account-type-form-page.component').then(
            (m) => m.AccountTypeFormPageComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./presentation/pages/account-type-form/account-type-form-page.component').then(
            (m) => m.AccountTypeFormPageComponent,
          ),
      },
    ],
  },
];
