import { Provider } from '@angular/core';
import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  GetCategoryUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
} from './application/category-use-cases';
import { CategoryRepository } from './domain/category.repository';
import { CategoryHttpRepository } from './infrastructure/category-http.repository';

/**
 * Enlaza el puerto de categorías con su adaptador. Se registra en `categories.routes.ts`
 * para que el adaptador quede dentro del chunk diferido, igual que en dashboard.
 */
export function provideCategories(): Provider[] {
  return [
    { provide: CategoryRepository, useClass: CategoryHttpRepository },
    ListCategoriesUseCase,
    GetCategoryUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
  ];
}
