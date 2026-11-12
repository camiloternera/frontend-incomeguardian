import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { providePeriods } from '@features/periods';
import { isTransactionType } from './domain/transaction';
import { provideTransactions } from './transactions.providers';
import { TransactionListPageComponent } from './presentation/pages/transaction-list/transaction-list-page.component';

/** Ruta del listado, a la que vuelve cualquier dirección de panel que no exista. */
export const TRANSACTIONS_URL = '/transactions';

/** Registrar o editar un movimiento abre un panel junto a la lista; en mobile el panel ocupa la pantalla. */
const loadPanel = () =>
  import('./presentation/components/transaction-panel/transaction-panel.component').then(
    (m) => m.TransactionPanelComponent,
  );

/** Solo se abre el panel para un tipo conocido; cualquier otro vuelve al listado conservando los filtros. */
const knownType: CanActivateFn = (route, state) => {
  if (isTransactionType(route.paramMap.get('type'))) {
    return true;
  }

  const router = inject(Router);

  return router.createUrlTree([TRANSACTIONS_URL], {
    queryParams: router.parseUrl(state.url).queryParams,
  });
};

/** El detalle de un movimiento (su plan de cuotas) se abre en el mismo lugar que el panel. */
const loadDetail = () =>
  import('./presentation/components/transaction-detail/transaction-detail.component').then(
    (m) => m.TransactionDetailComponent,
  );

/** Solo se abre el detalle para un id numérico; cualquier otro vuelve al listado. */
const numericId: CanActivateFn = (route, state) => {
  if (/^\d+$/.test(route.paramMap.get('id') ?? '')) {
    return true;
  }

  const router = inject(Router);

  return router.createUrlTree([TRANSACTIONS_URL], {
    queryParams: router.parseUrl(state.url).queryParams,
  });
};

export const transactionsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('transactions'), provideTransactions(), providePeriods()],
    component: TransactionListPageComponent,
    children: [
      { path: 'new', pathMatch: 'full', redirectTo: 'new/expense' },
      { path: 'new/:type', canActivate: [knownType], loadComponent: loadPanel },
      // Editar reutiliza el panel de registro con los datos del movimiento.
      { path: ':id/edit', canActivate: [numericId], loadComponent: loadPanel },
      { path: ':id', canActivate: [numericId], loadComponent: loadDetail },
    ],
  },
];
