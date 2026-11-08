import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideEllipsis, LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PaginationComponent } from '@shared/ui/pagination.component';
import { ListCategoriesUseCase } from '../../../application/category-use-cases';
import { CATEGORY_TYPES, Category, CategoryType, matchesCategory } from '../../../domain/category';
import { CategoryError } from '../../../domain/category-error';
import { CategoryWorkspace } from '../../category-workspace';

/** Categorías por página: caben en pantalla sin tener que desplazarse. */
export const CATEGORY_PAGE_SIZE = 5;

@Component({
  selector: 'app-category-list-page',
  imports: [
    DatePipe,
    RouterLink,
    RouterOutlet,
    TranslocoDirective,
    PaginationComponent,
    LucideEllipsis,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
  ],
  providers: [CategoryWorkspace],
  templateUrl: './category-list-page.component.html',
  styleUrls: ['./category-list-page.component.css'],
})
export class CategoryListPageComponent {
  private readonly listCategories = inject(ListCategoriesUseCase);
  private readonly workspace = inject(CategoryWorkspace);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Una pestaña por tipo de movimiento. */
  protected readonly tabs = CATEGORY_TYPES;
  protected readonly pageSize = CATEGORY_PAGE_SIZE;
  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;

  protected readonly categories = this.workspace.categories;
  protected readonly notice = this.workspace.notice;
  protected readonly selectedId = this.workspace.selectedId;
  protected readonly loadError = signal('');

  /** Texto de búsqueda; filtra todas las pestañas a la vez. */
  protected readonly query = signal('');
  /** Si el panel de crear o editar está abierto (hay una ruta hija activa). */
  protected readonly panelOpen = signal(false);
  /** Fila cuyo menú de acciones está desplegado. */
  protected readonly openMenuId = signal<number | null>(null);

  /** Categoría cuya eliminación espera confirmación en su propia fila. */
  protected readonly pendingDeleteId = signal<number | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal('');

  private readonly matching = computed(() => (this.categories() ?? []).filter((category) => matchesCategory(category, this.query())));

  /** Cuántas categorías de cada tipo coinciden con la búsqueda, para el contador de cada pestaña. */
  protected readonly counts = computed(() => {
    const counts: Record<CategoryType, number> = { income: 0, expense: 0, transfer: 0 };

    for (const category of this.matching()) {
      counts[category.type]++;
    }

    return counts;
  });
  protected readonly searching = computed(() => this.query().trim() !== '');

  /** Pestaña visible; vive en el workspace para que el panel proponga ese tipo al crear. */
  protected readonly tab = this.workspace.type;
  /** Categorías de la pestaña visible que coinciden con la búsqueda. */
  protected readonly visible = computed(() => this.matching().filter((category) => category.type === this.tab()));

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

  protected search(value: string): void {
    this.query.set(value);
    this.requestedPage.set(1);
  }

  protected selectTab(tab: CategoryType): void {
    this.tab.set(tab);
    this.requestedPage.set(1);
    this.pendingDeleteId.set(null);
  }

  protected goToPage(page: number): void {
    this.requestedPage.set(page);
    this.pendingDeleteId.set(null);
    this.openMenuId.set(null);
  }

  protected toggleMenu(id: number, event: Event): void {
    // Evita que el clic llegue al documento y cierre el menú en el mismo instante.
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  /** Cierra el menú con Escape y devuelve el foco al botón que lo abrió. */
  protected closeMenu(id: number): void {
    this.openMenuId.set(null);
    this.host.nativeElement.querySelector<HTMLButtonElement>(`#category-menu-button-${id}`)?.focus();
  }

  /** Un clic fuera de un menú abierto lo cierra. */
  @HostListener('document:click')
  protected closeMenus(): void {
    this.openMenuId.set(null);
  }

  protected askDelete(category: Category): void {
    this.openMenuId.set(null);
    this.deleteError.set('');
    this.pendingDeleteId.set(category.id);
  }

  protected cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  protected confirmDelete(category: Category): void {
    this.isDeleting.set(true);
    this.deleteError.set('');

    this.workspace
      .remove(category)
      .pipe(
        finalize(() => {
          this.isDeleting.set(false);
          this.pendingDeleteId.set(null);
        }),
      )
      .subscribe({ error: (error: unknown) => this.deleteError.set(this.messageOf(error)) });
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  private messageOf(error: unknown): string {
    return error instanceof CategoryError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
