import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucidePlus, LucideX } from '@lucide/angular';
import { Observable, finalize, map, startWith } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { normalizeAmount, parseAmount } from '@shared/money/amount-input';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import {
  RemoveBudgetUseCase,
  ResetMonthBudgetUseCase,
  SaveBudgetUseCase,
} from '../../../application/budget-use-cases';
import {
  BUDGET_AMOUNT_MAX_DECIMALS,
  BUDGET_AMOUNT_MAX_INTEGER_DIGITS,
  BUDGET_CATEGORY_TYPES,
  BUDGET_CURRENCIES,
  BudgetCurrency,
  BudgetRow,
  BudgetScope,
  compareMonths,
  formatMonthKey,
  hasBudget,
  isBudgetCurrency,
  monthOfDay,
  todayInBudgetZone,
} from '../../../domain/budget';
import {
  AMOUNT_ERROR_CODES,
  BudgetError,
  BudgetErrorCode,
  CATEGORY_ERROR_CODES,
  CURRENCY_ERROR_CODES,
} from '../../../domain/budget-error';
import { capitalized, currencySymbol, formatAmountInput, formatMoney, monthInSentence } from '../../budget-format';
import { BudgetWorkspace, rowKey } from '../../budget-workspace';
import { BudgetMonthDetailComponent } from '../budget-month-detail/budget-month-detail.component';

/** Estado del panel: cargando el resumen, listo, sin esa fila o de solo lectura. */
type PanelStatus = 'loading' | 'ready' | 'notFound' | 'readOnly';

/** Por qué el panel es de solo lectura. */
type ReadOnlyReason = 'closed' | 'future' | 'inactive';

/** Texto traducible: clave y parámetros. */
interface Copy {
  key: string;
  params?: Record<string, unknown>;
}

/** Ruta del listado, a la que vuelve el panel al cerrarse. */
const LIST_URL = '/budgets';

/**
 * Formato del tope: número de hasta 2 decimales y 15 cifras enteras, mayor o igual a cero. Que sea
 * mayor que cero en un tope recurrente lo decide `amountError`, porque depende del alcance.
 */
function budgetAmountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = (control.value ?? '').trim();

  if (!value) {
    return { required: true };
  }

  const normalized = normalizeAmount(value);

  if (normalized === null) {
    return { amountInvalid: true };
  }

  const [integer, decimals = ''] = normalized.split('.');

  if (decimals.length > BUDGET_AMOUNT_MAX_DECIMALS) {
    return { amountInvalid: true };
  }

  return integer.replace(/^0+(?=\d)/, '').length > BUDGET_AMOUNT_MAX_INTEGER_DIGITS ? { amountTooLarge: true } : null;
}

/**
 * Panel para agregar o editar el tope de una categoría junto al presupuesto (en mobile ocupa la
 * pantalla). Vive en una ruta hija (`new` o `:categoryId/:currency`) y avisa los cambios mediante
 * `BudgetWorkspace` para que la página vuelva a pedir el resumen.
 */
@Component({
  selector: 'app-budget-panel',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    SelectComponent,
    BudgetMonthDetailComponent,
    LucidePlus,
    LucideX,
  ],
  templateUrl: './budget-panel.component.html',
})
export class BudgetPanelComponent {
  private readonly saveBudget = inject(SaveBudgetUseCase);
  private readonly removeBudget = inject(RemoveBudgetUseCase);
  private readonly resetMonth = inject(ResetMonthBudgetUseCase);
  private readonly workspace = inject(BudgetWorkspace);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly listUrl = LIST_URL;
  protected readonly currencies = BUDGET_CURRENCIES;
  protected readonly locale = inject(LanguageService).language;
  protected readonly amountParams = { decimals: BUDGET_AMOUNT_MAX_DECIMALS, digits: BUDGET_AMOUNT_MAX_INTEGER_DIGITS };

  /** Tope abierto: categoría y moneda; `null` al agregar uno nuevo. */
  private readonly target = signal<{ categoryId: number; currency: string } | null>(null);
  protected readonly isNew = computed(() => this.target() === null);

  protected readonly isSubmitting = signal(false);
  protected readonly isChanging = signal(false);
  protected readonly formError = signal('');
  protected readonly amountServerError = signal<BudgetErrorCode | null>(null);
  protected readonly categoryServerError = signal<BudgetErrorCode | null>(null);
  protected readonly currencyServerError = signal<BudgetErrorCode | null>(null);

  protected readonly form = this.formBuilder.group({
    categoryId: this.formBuilder.control<number | null>(null),
    currency: this.formBuilder.control<BudgetCurrency>('COP'),
    amount: ['', budgetAmountValidator],
    scope: this.formBuilder.control<BudgetScope>('recurring'),
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      startWith(this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  protected readonly month = this.workspace.month;
  protected readonly monthText = computed(() => monthInSentence(this.month(), this.locale()));
  /** El mes al inicio de una frase: «Noviembre 2026 usa un tope propio». */
  protected readonly monthStart = computed(() => capitalized(this.monthText(), this.locale()));
  protected readonly monthQuery = computed(() => ({ month: formatMonthKey(this.month()) }));

  /** La fila del resumen que se edita; `null` al agregar o si el resumen aún no llega. */
  protected readonly row = computed<BudgetRow | null>(() => {
    const target = this.target();
    const summary = this.workspace.summary();

    if (!target || !summary) {
      return null;
    }

    return summary.rows.find((row) => row.categoryId === target.categoryId && row.currency === target.currency) ?? null;
  });

  private readonly readOnlyReason = computed<ReadOnlyReason | null>(() => {
    if (this.workspace.summary()?.isClosed) {
      return 'closed';
    }

    // Un mes futuro solo se consulta: muestra el tope y las cuotas que ya caen en él. Una fila que no
    // existe en ese mes sigue siendo «no encontrada».
    const future = compareMonths(this.month(), monthOfDay(todayInBudgetZone())) > 0;

    if (this.workspace.summary() && future && (this.isNew() || this.row())) {
      return 'future';
    }

    const row = this.row();
    const category = row ? this.workspace.categories().find((item) => item.id === row.categoryId) : undefined;

    return category?.isActive === false ? 'inactive' : null;
  });

  protected readonly status = computed<PanelStatus>(() => {
    if (!this.workspace.summary()) {
      return 'loading';
    }

    if (this.readOnlyReason()) {
      return 'readOnly';
    }

    return !this.isNew() && !this.row() ? 'notFound' : 'ready';
  });

  protected readonly readOnlyCopy = computed(() => `budgets.form.readOnly.${this.readOnlyReason() ?? 'closed'}`);

  /** Moneda del tope: la de la fila al editar, la elegida al agregar. */
  protected readonly currency = computed(() => this.row()?.currency ?? this.formValue().currency);
  protected readonly symbol = computed(() => currencySymbol(this.currency(), this.locale()));

  /** Categorías de gasto y transferencia, activas y sin tope en la moneda elegida. */
  protected readonly categoryOptions = computed<SelectOption<number>[]>(() => {
    const summary = this.workspace.summary();
    const currency = this.formValue().currency;
    this.locale();

    return this.workspace
      .categories()
      .filter(
        (category) =>
          category.isActive &&
          category.type !== null &&
          (BUDGET_CATEGORY_TYPES as readonly string[]).includes(category.type) &&
          !(summary && hasBudget(summary, { categoryId: category.id, currency })),
      )
      .map((category) => ({
        value: category.id,
        label: `${category.name} · ${this.transloco.translate(`budgets.list.type.${category.type}`)}`,
      }));
  });

  protected readonly title = computed(() => this.row()?.categoryName ?? null);

  protected readonly subtitle = computed<Copy>(() => {
    const row = this.row();

    return row
      ? { key: 'budgets.form.editSubtitle', params: { type: this.transloco.translate(`budgets.list.type.${row.categoryType ?? 'unknown'}`), currency: row.currency } }
      : { key: 'budgets.form.newSubtitle', params: { month: this.monthText() } };
  });

  /** «Llevas $ 30.000 gastado en noviembre 2026.» */
  protected readonly spentNote = computed(() => {
    const row = this.row();

    return row && row.spentAmount > 0 ? formatMoney(row.spentAmount, row.currency, this.locale()) : null;
  });

  /** Tope recurrente cuando el mes usa uno propio; `undefined` si el mes no tiene tope propio. */
  protected readonly override = computed<{ recurring: string | null } | undefined>(() => {
    const row = this.row();

    if (row?.source !== 'month') {
      return undefined;
    }

    return { recurring: row.recurringAmount === null ? null : formatMoney(row.recurringAmount, row.currency, this.locale()) };
  });

  /** «Quitar tope» solo tiene sentido si hay un tope. */
  protected readonly canRemove = computed(() => {
    const row = this.row();

    return !!row && row.source !== 'none';
  });

  constructor() {
    const controls = this.form.controls;
    controls.amount.valueChanges.subscribe(() => this.amountServerError.set(null));
    controls.scope.valueChanges.subscribe(() => this.amountServerError.set(null));
    controls.categoryId.valueChanges.subscribe(() => this.categoryServerError.set(null));
    controls.currency.valueChanges.subscribe(() => {
      this.currencyServerError.set(null);
      // La categoría elegida puede ya tener tope en la otra moneda.
      controls.categoryId.setValue(null);
    });

    // Al pasar de una fila a otra, Angular reutiliza el panel: se reinicia con cada parámetro.
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const categoryId = Number(params.get('categoryId'));
        const currency = params.get('currency');

        this.open(Number.isInteger(categoryId) && categoryId > 0 && currency ? { categoryId, currency } : null);
      });

    // Cuando llega (o se recarga) el resumen, el formulario toma los valores de la fila.
    let filledFor: string | null = null;
    effect(() => {
      const row = this.row();
      const key = row ? rowKey(row.categoryId, row.currency) : null;

      untracked(() => {
        if (row && key !== filledFor && !this.form.dirty) {
          filledFor = key;
          this.fill(row);
        }
      });
    });

    inject(DestroyRef).onDestroy(() => this.workspace.selectedKey.set(null));

    // Lleva el foco al título para que el lector de pantalla anuncie el panel recién abierto.
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  protected amountError(): Copy | null {
    const server = this.amountServerError();

    if (server) {
      return { key: `budgets.errors.${server}` };
    }

    const control = this.form.controls.amount;

    if (!control.touched) {
      return null;
    }

    if (control.hasError('required')) {
      return { key: 'budgets.form.amountRequired' };
    }

    if (control.hasError('amountTooLarge')) {
      return { key: 'budgets.form.amountTooLarge', params: this.amountParams };
    }

    if (control.hasError('amountInvalid')) {
      return { key: 'budgets.form.amountInvalid', params: this.amountParams };
    }

    // Un tope recurrente de 0 no existe: para no gastar nada un mes se pausa solo ese mes.
    return this.formValue().scope === 'recurring' && parseAmount(control.value) === 0
      ? { key: 'budgets.form.amountPositive', params: { month: this.monthText() } }
      : null;
  }

  protected categoryError(): Copy | null {
    const server = this.categoryServerError();

    if (server) {
      return { key: `budgets.errors.${server}` };
    }

    const control = this.form.controls.categoryId;

    return this.isNew() && control.touched && control.value === null ? { key: 'budgets.form.categoryRequired' } : null;
  }

  protected currencyError(): Copy | null {
    const server = this.currencyServerError();

    return server ? { key: `budgets.errors.${server}` } : null;
  }

  protected chooseCurrency(currency: BudgetCurrency): void {
    this.form.controls.currency.setValue(currency);
  }

  protected chooseScope(scope: BudgetScope): void {
    this.form.controls.scope.setValue(scope);
  }

  protected closeOnEscape(): void {
    if (!this.form.dirty) {
      this.close();
    }
  }

  protected close(): void {
    void this.router.navigate([LIST_URL], { queryParams: this.queryParams() });
  }

  protected submit(): void {
    this.formError.set('');
    this.form.markAllAsTouched();

    const value = this.form.getRawValue();
    const categoryId = this.isNew() ? value.categoryId : (this.row()?.categoryId ?? null);
    const currency = this.currency();

    if (this.form.invalid || this.amountError() || this.categoryError() || categoryId === null || !isBudgetCurrency(currency)) {
      return;
    }

    const name = this.row()?.categoryName ?? this.workspace.categories().find((item) => item.id === categoryId)?.name ?? '';

    this.run(
      this.saveBudget.execute({
        categoryId,
        currency,
        amount: parseAmount(value.amount),
        month: this.month(),
        scope: value.scope,
      }),
      { kind: 'saved', name },
      this.isSubmitting,
    );
  }

  /** «Volver al tope recurrente»: borra el tope propio del mes. */
  protected reset(): void {
    const row = this.row();

    if (row) {
      this.run(this.resetMonth.execute(this.month(), row), { kind: 'reset', name: row.categoryName }, this.isChanging);
    }
  }

  /** «Quitar tope»: la categoría queda sin tope desde este mes. */
  protected remove(): void {
    const row = this.row();

    if (row) {
      this.run(this.removeBudget.execute(row, this.month()), { kind: 'removed', name: row.categoryName }, this.isChanging);
    }
  }

  private run(
    request: Observable<void>,
    notice: { kind: 'saved' | 'removed' | 'reset'; name: string },
    busy: typeof this.isSubmitting,
  ): void {
    this.formError.set('');
    busy.set(true);
    request.pipe(finalize(() => busy.set(false))).subscribe({
      next: () => {
        this.workspace.done(notice);
        this.close();
      },
      error: (error: unknown) => this.handleError(error),
    });
  }

  private open(target: { categoryId: number; currency: string } | null): void {
    this.target.set(target);
    this.workspace.selectedKey.set(target ? rowKey(target.categoryId, target.currency) : null);
    this.formError.set('');
    this.amountServerError.set(null);
    this.categoryServerError.set(null);
    this.currencyServerError.set(null);
    // Al agregar, se propone la moneda que la página está mostrando (`?currency=`).
    const filtered = this.route.snapshot.queryParamMap.get('currency');
    this.form.reset({
      categoryId: null,
      currency: isBudgetCurrency(filtered) ? filtered : 'COP',
      amount: '',
      scope: 'recurring',
    });

    const row = this.row();

    if (row) {
      this.fill(row);
    }
  }

  /** Monto y alcance a partir de la fila: un tope propio del mes propone «Solo este mes». */
  private fill(row: BudgetRow): void {
    this.form.reset({
      categoryId: row.categoryId,
      currency: isBudgetCurrency(row.currency) ? row.currency : 'COP',
      amount: row.source === 'none' ? '' : formatAmountInput(row.budgetAmount, this.locale()),
      scope: row.source === 'month' ? 'month' : 'recurring',
    });
  }

  /** Ubica el error del backend junto a su campo; si no pertenece a ninguno, lo muestra en el formulario. */
  private handleError(error: unknown): void {
    const code = error instanceof BudgetError ? error.code : null;

    if (code && AMOUNT_ERROR_CODES.includes(code)) {
      this.amountServerError.set(code);
    } else if (code && CATEGORY_ERROR_CODES.includes(code) && this.isNew()) {
      this.categoryServerError.set(code);
    } else if (code && CURRENCY_ERROR_CODES.includes(code) && this.isNew()) {
      this.currencyServerError.set(code);
    } else {
      this.formError.set(error instanceof BudgetError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY));

      // Otro dispositivo pudo cerrar el mes o quitar el tope: el resumen nuevo lo refleja.
      if (code === BudgetErrorCode.PeriodClosed || code === BudgetErrorCode.NotFound) {
        this.workspace.refresh();
      }
    }
  }

  private queryParams(): Record<string, string> {
    return this.router.parseUrl(this.router.url).queryParams;
  }
}

