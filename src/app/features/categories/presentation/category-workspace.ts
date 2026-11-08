import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DeleteCategoryUseCase } from '../application/category-use-cases';
import { Category, CategoryType, sortCategories } from '../domain/category';
import { CategoryError, CategoryErrorCode } from '../domain/category-error';

/** Acción completada que la vista confirma al usuario. */
export interface CategoryNotice {
  kind: 'created' | 'updated' | 'deleted';
  name: string;
}

/**
 * Estado que comparten el listado y el panel lateral mientras conviven en pantalla.
 * Lo provee la página del listado, así el panel actualiza la lista sin volver a pedirla al backend.
 */
@Injectable()
export class CategoryWorkspace {
  private readonly deleteCategory = inject(DeleteCategoryUseCase);

  /** `null` mientras se cargan las categorías por primera vez. */
  readonly categories = signal<Category[] | null>(null);
  /** Aviso de la última acción completada. */
  readonly notice = signal<CategoryNotice | null>(null);
  /** Categoría abierta en el panel, para resaltarla en la lista. */
  readonly selectedId = signal<number | null>(null);
  /** Pestaña visible del listado; también es el tipo que propone el panel al crear. */
  readonly type = signal<CategoryType>('expense');

  /** Incorpora a la lista una categoría recién creada o editada, muestra su pestaña y avisa del cambio. */
  saved(category: Category, kind: 'created' | 'updated'): void {
    this.type.set(category.type);
    this.categories.update((categories) =>
      categories === null ? null : sortCategories([...categories.filter((item) => item.id !== category.id), category]),
    );
    this.notice.set({ kind, name: category.name });
  }

  /**
   * Elimina la categoría y la retira de la lista. Si el backend ya no la tiene, también se retira,
   * pero el error sigue su curso para que la vista lo cuente.
   */
  remove(category: Category): Observable<void> {
    return this.deleteCategory.execute(category.id).pipe(
      tap({
        next: () => {
          this.drop(category.id);
          this.notice.set({ kind: 'deleted', name: category.name });
        },
        error: (error: unknown) => {
          if (error instanceof CategoryError && error.code === CategoryErrorCode.NotFound) {
            this.drop(category.id);
          }
        },
      }),
    );
  }

  private drop(id: number): void {
    this.categories.update((categories) => categories?.filter((category) => category.id !== id) ?? null);
  }
}
