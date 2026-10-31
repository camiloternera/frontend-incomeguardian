import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideCategories } from './categories.providers';
import { CategoryListPageComponent } from './presentation/pages/category-list/category-list-page.component';

export const categoriesRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('categories'), provideCategories()],
    children: [
      { path: '', component: CategoryListPageComponent },
      {
        path: 'new',
        loadComponent: () =>
          import('./presentation/pages/category-form/category-form-page.component').then(
            (m) => m.CategoryFormPageComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./presentation/pages/category-form/category-form-page.component').then(
            (m) => m.CategoryFormPageComponent,
          ),
      },
    ],
  },
];
