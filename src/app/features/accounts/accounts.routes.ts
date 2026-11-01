import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideAccounts } from './accounts.providers';
import { AccountListPageComponent } from './presentation/pages/account-list/account-list-page.component';

/** Crear y editar abren un panel junto a la lista; en mobile el panel ocupa la pantalla. */
const loadPanel = () =>
  import('./presentation/components/account-panel/account-panel.component').then(
    (m) => m.AccountPanelComponent,
  );

export const accountsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('accounts'), provideAccounts()],
    component: AccountListPageComponent,
    children: [
      { path: 'new', loadComponent: loadPanel },
      { path: ':id/edit', loadComponent: loadPanel },
    ],
  },
];
