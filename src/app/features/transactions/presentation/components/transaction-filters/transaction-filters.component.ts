import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideSearch, LucideX } from '@lucide/angular';
import { debounceTime, filter, map } from 'rxjs';
import { DatePickerComponent } from '@shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';

/** Filtros que elige la persona en el listado; `null` o texto vacío es «sin filtro». */
export interface TransactionFilterValues {
  search: string;
  categoryId: number | null;
  accountId: number | null;
  /** Primer día del rango (`YYYY-MM-DD`). */
  from: string | null;
  /** Último día del rango (`YYYY-MM-DD`). */
  to: string | null;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterValues = {
  search: '',
  categoryId: null,
  accountId: null,
  from: null,
  to: null,
};

/** Indica si hay algún filtro activo. */
export function hasTransactionFilters(filters: TransactionFilterValues): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.categoryId !== null ||
    filters.accountId !== null ||
    filters.from !== null ||
    filters.to !== null
  );
}

/** Espera tras la última tecla antes de buscar, para no pedir una página por letra. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Barra de filtros del listado de movimientos: texto, categoría, cuenta y rango de fechas. No
 * pide datos: recibe los valores y las opciones y emite los filtros cada vez que cambian.
 */
@Component({
  selector: 'app-transaction-filters',
  imports: [ReactiveFormsModule, TranslocoDirective, SelectComponent, DatePickerComponent, LucideSearch, LucideX],
  templateUrl: './transaction-filters.component.html',
  host: { class: 'block' },
})
export class TransactionFiltersComponent {
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  /** Filtros aplicados, por ejemplo los que vienen de la URL. */
  readonly value = input.required<TransactionFilterValues>();
  /** Categorías para elegir, ya con su nombre visible. */
  readonly categories = input.required<readonly SelectOption<number>[]>();
  readonly accounts = input.required<readonly SelectOption<number>[]>();
  /** Hoy en hora de Colombia (`YYYY-MM-DD`): no se eligen fechas futuras. */
  readonly today = input.required<string>();
  /** Textos de «Todas las categorías» y «Todas las cuentas», ya traducidos. */
  readonly allCategoriesLabel = input.required<string>();
  readonly allAccountsLabel = input.required<string>();

  readonly filtersChange = output<TransactionFilterValues>();

  protected readonly form = this.formBuilder.group({
    search: '',
    categoryId: this.formBuilder.control<number | null>(null),
    accountId: this.formBuilder.control<number | null>(null),
    from: this.formBuilder.control<string | null>(null),
    to: this.formBuilder.control<string | null>(null),
  });

  /** La primera opción quita el filtro. */
  protected readonly categoryOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: this.allCategoriesLabel() },
    ...this.categories(),
  ]);
  protected readonly accountOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: this.allAccountsLabel() },
    ...this.accounts(),
  ]);

  protected readonly active = computed(() => hasTransactionFilters(this.value()));

  /** Fechas elegidas, para limitar un extremo del rango con el otro. */
  private readonly formValue = signal(this.form.getRawValue());
  protected readonly fromMax = computed(() => this.formValue().to ?? this.today());
  protected readonly toMin = computed(() => this.formValue().from);

  constructor() {
    // El formulario refleja los filtros aplicados sin volver a emitirlos.
    effect(() => {
      const value = this.value();
      const current = this.form.getRawValue();

      if (JSON.stringify(current) !== JSON.stringify(value)) {
        this.form.setValue(value, { emitEvent: false });
        this.formValue.set(this.form.getRawValue());
      }
    });

    // El texto se aplica cuando la persona deja de escribir.
    this.form.controls.search.valueChanges
      .pipe(
        map((text) => text.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        // Compara con lo aplicado, no con la búsqueda anterior a limpiar o navegar.
        filter((text) =>
          text === this.form.controls.search.value.trim() && text !== this.value().search.trim(),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.emit());

    this.form.controls.categoryId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.emit());
    this.form.controls.accountId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.emit());
    this.form.controls.from.valueChanges.pipe(takeUntilDestroyed()).subscribe((from) => {
      // Un «Desde» posterior al «Hasta» deja el rango sin final, en vez de un rango imposible.
      const to = this.form.controls.to.value;

      if (from && to && from > to) {
        this.form.controls.to.setValue(null, { emitEvent: false });
      }

      this.emit();
    });
    this.form.controls.to.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.emit());
  }

  protected clear(): void {
    this.form.setValue(EMPTY_TRANSACTION_FILTERS, { emitEvent: false });
    this.formValue.set(this.form.getRawValue());
    this.filtersChange.emit(EMPTY_TRANSACTION_FILTERS);
  }

  private emit(): void {
    const value = this.form.getRawValue();
    this.formValue.set(value);
    this.filtersChange.emit({ ...value, search: value.search.trim() });
  }
}
