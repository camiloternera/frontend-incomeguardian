import { Routes } from '@angular/router';
import { categoriesRoutes } from '../categories.routes';
import { Observable, of, throwError } from 'rxjs';
import { Category, CategoryDraft, NewCategoryDraft } from '../domain/category';
import { CategoryError, CategoryErrorCode } from '../domain/category-error';
import { CategoryRepository } from '../domain/category.repository';

/** Repositorio en memoria para los tests de presentation; `failWith` fuerza el siguiente error. */
export class FakeCategoryRepository extends CategoryRepository {
  categories: Category[] = [
    { id: 1, name: 'Vivienda', description: 'Arriendo y servicios', type: 'expense', createdAt: '2026-10-01T00:00:00Z', updatedAt: null },
    { id: 9, name: 'Mascotas', description: 'Comida y veterinario', type: 'expense', createdAt: '2026-10-20T00:00:00Z', updatedAt: null },
    { id: 4, name: 'Salario', description: 'Pago mensual', type: 'income', createdAt: '2026-10-02T00:00:00Z', updatedAt: null },
  ];
  failWith: CategoryError | null = null;
  lastDraft: CategoryDraft | NewCategoryDraft | null = null;

  list(): Observable<Category[]> {
    return this.respond(() => [...this.categories]);
  }

  get(id: number): Observable<Category> {
    return this.respond(() => this.find(id));
  }

  create(draft: NewCategoryDraft): Observable<Category> {
    this.lastDraft = draft;
    return this.respond(() => ({ id: 99, ...draft, createdAt: '2026-10-30T00:00:00Z', updatedAt: null }));
  }

  update(id: number, draft: CategoryDraft): Observable<Category> {
    this.lastDraft = draft;
    return this.respond(() => ({ ...this.find(id), ...draft }));
  }

  remove(id: number): Observable<void> {
    return this.respond(() => {
      this.categories = this.categories.filter((category) => category.id !== id);
    });
  }

  private find(id: number): Category {
    const category = this.categories.find((item) => item.id === id);

    if (!category) {
      throw new CategoryError('Not found', CategoryErrorCode.NotFound);
    }

    return category;
  }

  private respond<T>(value: () => T): Observable<T> {
    const error = this.failWith;
    this.failWith = null;

    if (error) {
      return throwError(() => error);
    }

    try {
      return of(value());
    } catch (thrown) {
      return throwError(() => thrown);
    }
  }
}

/** Las rutas reales del dominio montadas en `/categories`, con el repositorio falso en lugar del HTTP. */
export function fakeCategoriesRoutes(fake: FakeCategoryRepository): Routes {
  const [root] = categoriesRoutes;

  return [
    {
      path: 'categories',
      children: [{ ...root, providers: [...(root.providers ?? []), { provide: CategoryRepository, useValue: fake }] }],
    },
  ];
}
