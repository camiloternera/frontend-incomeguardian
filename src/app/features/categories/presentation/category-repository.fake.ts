import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { provideCategories } from '../categories.providers';
import { Category, CategoryDraft } from '../domain/category';
import { CategoryError, CategoryErrorCode } from '../domain/category-error';
import { CategoryRepository } from '../domain/category.repository';

/** Repositorio en memoria para los tests de presentation; `failWith` fuerza el siguiente error. */
export class FakeCategoryRepository extends CategoryRepository {
  categories: Category[] = [
    { id: 1, name: 'Vivienda', description: 'Arriendo y servicios', isGlobal: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: null },
    { id: 9, name: 'Mascotas', description: 'Comida y veterinario', isGlobal: false, createdAt: '2026-10-20T00:00:00Z', updatedAt: null },
  ];
  failWith: CategoryError | null = null;
  lastDraft: CategoryDraft | null = null;

  list(): Observable<Category[]> {
    return this.respond(() => [...this.categories]);
  }

  get(id: number): Observable<Category> {
    return this.respond(() => this.find(id));
  }

  create(draft: CategoryDraft): Observable<Category> {
    this.lastDraft = draft;
    return this.respond(() => ({ id: 99, ...draft, isGlobal: false, createdAt: '2026-10-30T00:00:00Z', updatedAt: null }));
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

/** Los proveedores reales del dominio, con el repositorio HTTP sustituido por el falso. */
export function provideFakeCategories(fake: FakeCategoryRepository): Provider[] {
  return [...provideCategories(), { provide: CategoryRepository, useValue: fake }];
}
