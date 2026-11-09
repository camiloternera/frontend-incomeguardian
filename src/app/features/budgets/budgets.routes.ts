import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { providePeriods } from '@features/periods';
import { provideBudgets } from './budgets.providers';
import { BudgetListPageComponent } from './presentation/pages/budget-list/budget-list-page.component';

/** Agregar o editar un tope abre un panel junto al presupuesto; en mobile el panel ocupa la pantalla. */
const loadPanel = () =>
  import('./presentation/components/budget-panel/budget-panel.component').then((m) => m.BudgetPanelComponent);

export const budgetsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('budgets'), provideBudgets(), providePeriods()],
    component: BudgetListPageComponent,
    children: [
      { path: 'new', loadComponent: loadPanel },
      { path: ':categoryId/:currency', loadComponent: loadPanel },
    ],
  },
];
