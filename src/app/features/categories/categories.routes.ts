import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideCategories } from './categories.providers';
import { CategoryListPageComponent } from './presentation/pages/category-list/category-list-page.component';

/** Crear y editar abren un panel junto a la lista; en mobile el panel ocupa la pantalla. */
const loadPanel = () =>
  import('./presentation/components/category-panel/category-panel.component').then((m) => m.CategoryPanelComponent);

export const categoriesRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('categories'), provideCategories()],
    component: CategoryListPageComponent,
    children: [
      { path: 'new', loadComponent: loadPanel },
      { path: ':id/edit', loadComponent: loadPanel },
    ],
  },
];
