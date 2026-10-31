import { Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

/** Elemento de la barra: un número de página o un salto entre páginas lejanas. */
type PageSlot = number | 'gap';

/** Páginas visibles a cada lado de la actual antes de abreviar con un salto. */
const SIBLINGS = 1;

/**
 * Barra de paginación sin lógica de negocio: recibe la página actual y el total
 * de elementos, y emite la página elegida. Se oculta cuando todo cabe en una página.
 */
@Component({
  selector: 'app-pagination',
  imports: [TranslocoDirective, LucideChevronLeft, LucideChevronRight],
  host: { class: 'block' },
  template: `
    @if (totalPages() > 1) {
      <nav
        *transloco="let t"
        data-testid="pagination"
        class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
        [attr.aria-label]="t('pagination.label')"
      >
        <p class="m-0 text-[12px] text-ig-muted" aria-live="polite">
          {{ t('pagination.range', { from: rangeStart(), to: rangeEnd(), total: totalItems() }) }}
        </p>

        <ul class="m-0 flex list-none flex-wrap items-center gap-1 p-0">
          <li>
            <button
              data-testid="pagination-previous"
              class="inline-flex size-11 items-center justify-center rounded-lg border border-ig-border bg-transparent text-ig-text hover:bg-ig-surface-raised focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              type="button"
              [disabled]="page() === 1"
              [attr.aria-label]="t('pagination.previous')"
              (click)="go(page() - 1)"
            >
              <svg lucideChevronLeft [size]="16" aria-hidden="true"></svg>
            </button>
          </li>

          @for (slot of slots(); track $index) {
            <li>
              @if (slot === 'gap') {
                <span class="inline-flex size-11 items-center justify-center text-[13px] text-ig-muted" aria-hidden="true">…</span>
              } @else {
                <button
                  [attr.data-testid]="'pagination-page-' + slot"
                  class="inline-flex size-11 items-center justify-center rounded-lg border text-[13px] focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2"
                  [class]="slot === page() ? 'border-ig-accent bg-ig-accent font-bold text-ig-on-accent' : 'border-transparent bg-transparent text-ig-text hover:border-ig-border'"
                  type="button"
                  [attr.aria-current]="slot === page() ? 'page' : null"
                  [attr.aria-label]="t('pagination.page', { page: slot })"
                  (click)="go(slot)"
                >
                  {{ slot }}
                </button>
              }
            </li>
          }

          <li>
            <button
              data-testid="pagination-next"
              class="inline-flex size-11 items-center justify-center rounded-lg border border-ig-border bg-transparent text-ig-text hover:bg-ig-surface-raised focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              type="button"
              [disabled]="page() === totalPages()"
              [attr.aria-label]="t('pagination.next')"
              (click)="go(page() + 1)"
            >
              <svg lucideChevronRight [size]="16" aria-hidden="true"></svg>
            </button>
          </li>
        </ul>
      </nav>
    }
  `,
})
export class PaginationComponent {
  /** Página actual, empezando en 1. */
  readonly page = input.required<number>();
  readonly totalItems = input.required<number>();
  readonly pageSize = input.required<number>();

  /** Emite la página elegida; quien usa el componente decide si la acepta. */
  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));
  protected readonly rangeStart = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.totalItems()));

  /** Primera y última página siempre visibles; alrededor de la actual, sus vecinas; el resto se abrevia. */
  protected readonly slots = computed<PageSlot[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    const slots: PageSlot[] = [];

    for (let page = 1; page <= total; page++) {
      const isEdge = page === 1 || page === total;
      const isNear = Math.abs(page - current) <= SIBLINGS;

      if (isEdge || isNear) {
        slots.push(page);
      } else if (slots.at(-1) !== 'gap') {
        slots.push('gap');
      }
    }

    return slots;
  });

  protected go(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }
}
