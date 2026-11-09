import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucideEllipsis, LucidePencil, LucidePlus, LucideRotateCcw, LucideSearch } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PaginationComponent } from '@shared/ui/pagination.component';
import { ListCategoriesUseCase } from '../../../application/category-use-cases';
import { CATEGORY_TABS, Category, CategoryTab, matchesCategory, sortByTypeThenName } from '../../../domain/category';
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
    LucideBan,
    LucideEllipsis,
    LucidePencil,
    LucidePlus,
    LucideRotateCcw,
    LucideSearch,
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

  /** Una pestaña por tipo de movimiento para las activas, más la de desactivadas. */
  protected readonly tabs = CATEGORY_TABS;
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

  /** Categoría cuya desactivación espera confirmación en su propia fila. */
  protected readonly pendingDeactivateId = signal<number | null>(null);
  /** Categoría que se está desactivando o reactivando. */
  protected readonly busyId = signal<number | null>(null);
  protected readonly actionError = signal('');

  private readonly matching = computed(() => (this.categories() ?? []).filter((category) => matchesCategory(category, this.query())));

  /** Cuántas categorías de cada pestaña coinciden con la búsqueda, para su contador. */
  protected readonly counts = computed(() => {
    const counts: Record<CategoryTab, number> = { income: 0, expense: 0, transfer: 0, inactive: 0 };

    for (const category of this.matching()) {
      counts[category.isActive ? category.type : 'inactive']++;
    }

    return counts;
  });
  protected readonly searching = computed(() => this.query().trim() !== '');

  /** Pestaña visible; vive en el workspace para que el panel proponga ese tipo al crear. */
  protected readonly tab = this.workspace.tab;
  /**
   * Categorías de la pestaña visible que coinciden con la búsqueda. Las desactivadas se agrupan
   * por tipo, en el mismo orden que las pestañas.
   */
  protected readonly visible = computed(() => {
    const tab = this.tab();

    return tab === 'inactive'
      ? sortByTypeThenName(this.matching().filter((category) => !category.isActive))
      : this.matching().filter((category) => category.isActive && category.type === tab);
  });

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

  protected selectTab(tab: CategoryTab): void {
    this.tab.set(tab);
    this.requestedPage.set(1);
    this.pendingDeactivateId.set(null);
    this.actionError.set('');
  }

  protected goToPage(page: number): void {
    this.requestedPage.set(page);
    this.pendingDeactivateId.set(null);
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

  protected askDeactivate(category: Category): void {
    this.openMenuId.set(null);
    this.actionError.set('');
    this.pendingDeactivateId.set(category.id);
  }

  protected cancelDeactivate(): void {
    this.pendingDeactivateId.set(null);
  }

  protected confirmDeactivate(category: Category): void {
    this.run(category, this.workspace.deactivate(category));
  }

  /** Reactivar no es destructivo: se hace sin pedir confirmación. */
  protected activate(category: Category): void {
    this.openMenuId.set(null);
    this.run(category, this.workspace.activate(category));
  }

  private run(category: Category, request: Observable<Category>): void {
    this.busyId.set(category.id);
    this.actionError.set('');

    request
      .pipe(
        finalize(() => {
          this.busyId.set(null);
          this.pendingDeactivateId.set(null);
        }),
      )
      .subscribe({ error: (error: unknown) => this.actionError.set(this.messageOf(error)) });
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  private messageOf(error: unknown): string {
    return error instanceof CategoryError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
