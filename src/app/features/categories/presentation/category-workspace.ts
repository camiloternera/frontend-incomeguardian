import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ActivateCategoryUseCase, DeactivateCategoryUseCase } from '../application/category-use-cases';
import { Category, CategoryTab, CategoryType, isCategoryType, sortCategories } from '../domain/category';
import { CategoryError, CategoryErrorCode } from '../domain/category-error';

/** Acción completada que la vista confirma al usuario. */
export interface CategoryNotice {
  kind: 'created' | 'updated' | 'deactivated' | 'activated';
  name: string;
}

/**
 * Estado que comparten el listado y el panel lateral mientras conviven en pantalla.
 * Lo provee la página del listado, así el panel actualiza la lista sin volver a pedirla al backend.
 */
@Injectable()
export class CategoryWorkspace {
  private readonly deactivateCategory = inject(DeactivateCategoryUseCase);
  private readonly activateCategory = inject(ActivateCategoryUseCase);

  /** Activas y desactivadas; `null` mientras se cargan por primera vez. */
  readonly categories = signal<Category[] | null>(null);
  /** Aviso de la última acción completada. */
  readonly notice = signal<CategoryNotice | null>(null);
  /** Categoría abierta en el panel, para resaltarla en la lista. */
  readonly selectedId = signal<number | null>(null);
  /** Pestaña visible del listado; si es un tipo, también es el que propone el panel al crear. */
  readonly tab = signal<CategoryTab>('expense');

  /** Tipo que se propone al crear: el de la pestaña visible, o gasto si se ven las desactivadas. */
  proposedType(): CategoryType {
    const tab = this.tab();

    return isCategoryType(tab) ? tab : 'expense';
  }

  /** Incorpora a la lista una categoría recién creada o editada, muestra su pestaña y avisa del cambio. */
  saved(category: Category, kind: 'created' | 'updated'): void {
    this.tab.set(category.type);
    this.put(category);
    this.notice.set({ kind, name: category.name });
  }

  /** Desactiva la categoría y la pasa a la pestaña de desactivadas. */
  deactivate(category: Category): Observable<Category> {
    return this.deactivateCategory
      .execute(category.id)
      .pipe(this.track(category, false, CategoryErrorCode.AlreadyInactive, 'deactivated'));
  }

  /** Reactiva la categoría y la devuelve a la pestaña de su tipo. */
  activate(category: Category): Observable<Category> {
    return this.activateCategory
      .execute(category.id)
      .pipe(this.track(category, true, CategoryErrorCode.AlreadyActive, 'activated'));
  }

  /**
   * Refleja el resultado en la lista. Si el backend ya la tenía en el estado pedido, o ya no la
   * tiene, la lista se sincroniza igual, pero el error sigue su curso para que la vista lo cuente.
   */
  private track(
    category: Category,
    isActive: boolean,
    alreadyCode: CategoryErrorCode,
    kind: 'deactivated' | 'activated',
  ) {
    return tap<Category>({
      next: (updated) => {
        this.put(updated);
        this.notice.set({ kind, name: updated.name });
      },
      error: (error: unknown) => {
        if (!(error instanceof CategoryError)) {
          return;
        }

        if (error.code === alreadyCode) {
          this.put({ ...category, isActive });
        } else if (error.code === CategoryErrorCode.NotFound) {
          this.drop(category.id);
        }
      },
    });
  }

  private put(category: Category): void {
    this.categories.update((categories) =>
      categories === null ? null : sortCategories([...categories.filter((item) => item.id !== category.id), category]),
    );
  }

  private drop(id: number): void {
    this.categories.update((categories) => categories?.filter((category) => category.id !== id) ?? null);
  }
}
