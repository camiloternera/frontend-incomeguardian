import { Component, computed, effect, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { PAGE_SIZE_OPTIONS } from './page-size';
import { SelectComponent, SelectOption } from './select/select.component';

/** Elemento de la barra: un número de página o un salto entre páginas lejanas. */
type PageSlot = number | 'gap';

/** Páginas visibles a cada lado de la actual antes de abreviar con un salto. */
const SIBLINGS = 1;

let nextId = 0;

/**
 * Barra de paginación sin lógica de negocio: recibe la página actual, el total de elementos y
 * cuántos van por página, y emite la página o la cantidad elegidas. Se oculta cuando todo cabe en
 * la cantidad más pequeña que se puede elegir; con una sola página muestra el rango y el selector
 * de cantidad, sin botones de página.
 */
@Component({
  selector: 'app-pagination',
  imports: [TranslocoDirective, ReactiveFormsModule, SelectComponent, LucideChevronLeft, LucideChevronRight],
  host: { class: 'block' },
  template: `
    @if (visible()) {
      <nav
        *transloco="let t"
        data-testid="pagination"
        class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
        [attr.aria-label]="t('pagination.label')"
      >
        <div class="flex flex-wrap items-center gap-4">
          <p class="m-0 text-[12px] text-ig-muted" aria-live="polite">
            {{ t('pagination.range', { from: rangeStart(), to: rangeEnd(), total: totalItems() }) }}
          </p>

          @if (sizeOptions().length > 0) {
            <div class="flex items-center gap-2">
              <label class="text-[12px] text-ig-muted" [for]="sizeId">{{ t('pagination.pageSize') }}</label>
              <app-select
                class="w-[88px]"
                data-testid="pagination-size"
                [inputId]="sizeId"
                [options]="sizeOptions()"
                [formControl]="sizeControl"
              />
            </div>
          }
        </div>

        @if (totalPages() > 1) {
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
        }
      </nav>
    }
  `,
})
export class PaginationComponent {
  /** Página actual, empezando en 1. */
  readonly page = input.required<number>();
  readonly totalItems = input.required<number>();
  readonly pageSize = input.required<number>();
  /** Cantidades que ofrece el selector de registros por página; vacío lo oculta. */
  readonly pageSizeOptions = input<readonly number[]>(PAGE_SIZE_OPTIONS);

  /** Emite la página elegida; quien usa el componente decide si la acepta. */
  readonly pageChange = output<number>();
  /** Emite la cantidad de registros por página elegida. */
  readonly pageSizeChange = output<number>();

  protected readonly sizeId = `pagination-size-${nextId++}`;
  protected readonly sizeControl = new FormControl<number | null>(null);
  protected readonly sizeOptions = computed<SelectOption<number>[]>(() =>
    this.pageSizeOptions().map((size) => ({ value: size, label: String(size) })),
  );

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));
  protected readonly rangeStart = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.totalItems()));

  /**
   * Se muestra si hay más elementos que la cantidad más pequeña elegible: así, tras elegir una
   * cantidad grande que deja todo en una página, se puede volver a una menor.
   */
  protected readonly visible = computed(() => {
    const options = this.pageSizeOptions();

    return options.length > 0 ? this.totalItems() > Math.min(...options) : this.totalPages() > 1;
  });

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

  constructor() {
    // El selector refleja la cantidad que decide quien usa el componente.
    effect(() => this.sizeControl.setValue(this.pageSize(), { emitEvent: false }));
    this.sizeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((size) => {
      if (size !== null && size !== this.pageSize()) {
        this.pageSizeChange.emit(size);
      }
    });
  }

  protected go(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }
}
