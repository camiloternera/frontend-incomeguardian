import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideAccounts } from './accounts.providers';
import { AccountListPageComponent } from './presentation/pages/account-list/account-list-page.component';

/** Crear y editar abren un panel junto a la lista; en mobile el panel ocupa la pantalla. */
const loadPanel = () =>
  import('./presentation/components/account-panel/account-panel.component').then(
    (m) => m.AccountPanelComponent,
  );

/** El extracto de una tarjeta es una vista propia, con su mes en `?month=YYYY-MM`. */
const loadStatement = () =>
  import('./presentation/pages/card-statement/card-statement-page.component').then(
    (m) => m.CardStatementPageComponent,
  );

export const accountsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('accounts'), provideAccounts()],
    children: [
      {
        path: '',
        component: AccountListPageComponent,
        children: [
          { path: 'new', loadComponent: loadPanel },
          { path: ':id/edit', loadComponent: loadPanel },
        ],
      },
      { path: ':id/statement', loadComponent: loadStatement },
    ],
  },
];
