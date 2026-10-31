import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideLock, LucidePencil, LucidePlus, LucideTrash2 } from '@lucide/angular';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { AppTopBarComponent } from '@shared/ui/app-top-bar.component';
import { PaginationComponent } from '@shared/ui/pagination.component';
import { DeleteCategoryUseCase, ListCategoriesUseCase } from '../../../application/category-use-cases';
import { Category } from '../../../domain/category';
import { CategoryError, CategoryErrorCode } from '../../../domain/category-error';
import { CategoryNotice, CategoryNoticeState } from '../../category-notice';

/** Filtros del listado: todas, solo las propias o solo las predefinidas. */
export type CategoryFilter = 'all' | 'personal' | 'global';

const FILTERS: readonly CategoryFilter[] = ['all', 'personal', 'global'];

/** Categorías por página: suficientes para ver un bloque sin tener que desplazarse. */
export const CATEGORY_PAGE_SIZE = 8;

@Component({
  selector: 'app-category-list-page',
  imports: [
    DatePipe,
    RouterLink,
    TranslocoDirective,
    AppTopBarComponent,
    PaginationComponent,
    LucideLock,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
  ],
  templateUrl: './category-list-page.component.html',
  styleUrls: ['./category-list-page.component.css'],
})
export class CategoryListPageComponent {
  private readonly listCategories = inject(ListCategoriesUseCase);
  private readonly deleteCategory = inject(DeleteCategoryUseCase);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  protected readonly filters = FILTERS;
  private readonly listTop = viewChild<ElementRef<HTMLElement>>('listTop');

  /** `null` mientras se cargan las categorías por primera vez. */
  protected readonly categories = signal<Category[] | null>(null);
  protected readonly loadError = signal('');
  protected readonly filter = signal<CategoryFilter>('all');

  /** Categoría cuya eliminación espera confirmación en su propia fila. */
  protected readonly pendingDeleteId = signal<number | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal('');

  /** Aviso de la última acción completada, llegue desde el formulario o desde esta vista. */
  protected readonly notice = signal<CategoryNotice | null>(
    (this.router.currentNavigation()?.extras.state as CategoryNoticeState | undefined)?.notice ?? null,
  );

  protected readonly personalCount = computed(() => this.categories()?.filter((category) => !category.isGlobal).length ?? 0);
  protected readonly globalCount = computed(() => this.categories()?.filter((category) => category.isGlobal).length ?? 0);

  protected readonly visible = computed(() => {
    const categories = this.categories() ?? [];

    switch (this.filter()) {
      case 'personal':
        return categories.filter((category) => !category.isGlobal);
      case 'global':
        return categories.filter((category) => category.isGlobal);
      default:
        return categories;
    }
  });

  protected readonly pageSize = CATEGORY_PAGE_SIZE;
  private readonly requestedPage = signal(1);

  /** Página mostrada; si una eliminación deja la página vacía, retrocede a la última que exista. */
  protected readonly page = computed(() => {
    const lastPage = Math.max(1, Math.ceil(this.visible().length / CATEGORY_PAGE_SIZE));

    return Math.min(this.requestedPage(), lastPage);
  });

  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * CATEGORY_PAGE_SIZE;

    return this.visible().slice(start, start + CATEGORY_PAGE_SIZE);
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loadError.set('');
    this.listCategories.execute().subscribe({
      next: (categories) => this.categories.set(categories),
      error: (error: unknown) => this.loadError.set(this.messageOf(error)),
    });
  }

  protected countFor(filter: CategoryFilter): number {
    if (filter === 'personal') {
      return this.personalCount();
    }

    return filter === 'global' ? this.globalCount() : (this.categories()?.length ?? 0);
  }

  protected setFilter(filter: CategoryFilter): void {
    this.filter.set(filter);
    this.requestedPage.set(1);
  }

  /** Cambia de página y lleva la vista al inicio de la lista para leer el nuevo bloque desde arriba. */
  protected goToPage(page: number): void {
    this.requestedPage.set(page);
    this.pendingDeleteId.set(null);
    // `scrollIntoView` no existe en todos los entornos (jsdom en los tests), por eso la llamada opcional.
    this.listTop()?.nativeElement.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  protected askDelete(category: Category): void {
    this.deleteError.set('');
    this.pendingDeleteId.set(category.id);
  }

  protected cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  protected confirmDelete(category: Category): void {
    this.isDeleting.set(true);
    this.deleteError.set('');

    this.deleteCategory
      .execute(category.id)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.removeFromList(category.id);
          this.notice.set({ kind: 'deleted', name: category.name });
        },
        error: (error: unknown) => {
          // Si ya no existe, otra pestaña la eliminó: se retira de la lista igualmente.
          if (error instanceof CategoryError && error.code === CategoryErrorCode.NotFound) {
            this.removeFromList(category.id);
          }

          this.deleteError.set(this.messageOf(error));
        },
      });
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  private removeFromList(id: number): void {
    this.categories.update((categories) => categories?.filter((category) => category.id !== id) ?? null);
    this.pendingDeleteId.set(null);
  }

  private messageOf(error: unknown): string {
    return error instanceof CategoryError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
