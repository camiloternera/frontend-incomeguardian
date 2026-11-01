import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideAccountTypes } from './account-types.providers';
import { AccountTypeListPageComponent } from './presentation/pages/account-type-list/account-type-list-page.component';

/** Crear y editar abren un panel junto a la lista; en mobile el panel ocupa la pantalla. */
const loadPanel = () =>
  import('./presentation/components/account-type-panel/account-type-panel.component').then((m) => m.AccountTypePanelComponent);

export const accountTypesRoutes: Routes = [
  {
    path: '',
    // Transloco expone el scope `account-types` con la clave `accountTypes`.
    providers: [provideTranslocoScope('account-types'), provideAccountTypes()],
    component: AccountTypeListPageComponent,
    children: [
      { path: 'new', loadComponent: loadPanel },
      { path: ':id/edit', loadComponent: loadPanel },
    ],
  },
];
