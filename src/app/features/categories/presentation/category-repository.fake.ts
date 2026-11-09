import { Routes } from '@angular/router';
import { categoriesRoutes } from '../categories.routes';
import { Observable, of, throwError } from 'rxjs';
import { Category, CategoryDraft, NewCategoryDraft } from '../domain/category';
import { CategoryError, CategoryErrorCode } from '../domain/category-error';
import { CategoryRepository } from '../domain/category.repository';

/** Repositorio en memoria para los tests de presentation; `failWith` fuerza el siguiente error. */
export class FakeCategoryRepository extends CategoryRepository {
  categories: Category[] = [
    { id: 1, name: 'Vivienda', description: 'Arriendo y servicios', type: 'expense', isActive: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: null },
    { id: 9, name: 'Mascotas', description: 'Comida y veterinario', type: 'expense', isActive: true, createdAt: '2026-10-20T00:00:00Z', updatedAt: null },
    { id: 4, name: 'Salario', description: 'Pago mensual', type: 'income', isActive: true, createdAt: '2026-10-02T00:00:00Z', updatedAt: null },
    { id: 6, name: 'Gimnasio', description: 'Mensualidad', type: 'expense', isActive: false, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z' },
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
    return this.respond(() => ({ id: 99, ...draft, isActive: true, createdAt: '2026-10-30T00:00:00Z', updatedAt: null }));
  }

  update(id: number, draft: CategoryDraft): Observable<Category> {
    this.lastDraft = draft;
    return this.respond(() => ({ ...this.find(id), ...draft }));
  }

  deactivate(id: number): Observable<Category> {
    return this.respond(() => this.setActive(id, false));
  }

  activate(id: number): Observable<Category> {
    return this.respond(() => this.setActive(id, true));
  }

  private setActive(id: number, isActive: boolean): Category {
    const updated = { ...this.find(id), isActive };
    this.categories = this.categories.map((category) => (category.id === id ? updated : category));

    return updated;
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
