import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideChevronLeft, LucideChevronRight, LucideLock, LucidePlus, LucideRepeat } from '@lucide/angular';
import { Subscription, catchError, map, of, switchMap } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PeriodOverlaysComponent, ReopenPeriodButtonComponent, injectPeriodChanges } from '@features/periods';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import { GetBudgetSummaryUseCase, ListBudgetCategoryOptionsUseCase } from '../../../application/budget-use-cases';
import {
  BudgetCategoryOption,
  BudgetMonth,
  BudgetRow,
  BudgetUsage,
  barPercent,
  blocksOf,
  compareMonths,
  daysLeftInMonth,
  formatMonthKey,
  lastViewableMonth,
  monthOfDay,
  parseMonth,
  shiftMonth,
  todayInBudgetZone,
  totalPercent,
  installmentPurchases,
  usageOf,
} from '../../../domain/budget';
import { BudgetError } from '../../../domain/budget-error';
import { formatMoney, monthLabel, monthName } from '../../budget-format';
import { BudgetWorkspace, rowKey } from '../../budget-workspace';

/** Texto traducible: clave y parámetros. */
interface Copy {
  key: string;
  params?: Record<string, unknown>;
}

/** Tono del monto disponible: verde si queda, apagado en cero, color del texto si se pasó. */
type Tone = 'accent' | 'muted' | 'text';

/** Fila del resumen con todo lo que pinta la tabla ya resuelto. */
interface RowView {
  key: string;
  row: BudgetRow;
  /** «Gasto», «Transferencia», con « · categoría desactivada» si aplica. */
  kind: string;
  source: Copy;
  usage: BudgetUsage;
  note: Copy;
  /** Nota corta de la lista mobile. */
  shortNote: Copy;
  /** «$ 30.000 de $ 850.000 · solo este mes» en mobile. */
  meta: string;
  bar: number;
  budget: string;
  spent: string;
  available: string;
  tone: Tone;
  /** Se puede abrir en el panel: mes abierto o futuro y categoría activa. */
  editable: boolean;
  /** El panel se abre solo para consultar (mes futuro): cambia la etiqueta del enlace. */
  viewOnly: boolean;
  /** «N cuotas»: compras de más de una cuota que cuentan este mes; null si no hay. */
  installmentsChip: Copy | null;
}

/** Una moneda del resumen con sus totales ya formateados. */
interface BlockView {
  currency: string;
  budget: string;
  spent: string;
  available: string;
  tone: Tone;
  /** Porcentaje usado del total; null si no hay tope en esa moneda. */
  percent: number | null;
  /** «De eso, en compras a cuotas»; null si no hubo. */
  installmentsSpent: string | null;
  bar: number;
  rows: RowView[];
}

/** Ruta del listado, a la que vuelven el panel y los enlaces. */
export const BUDGETS_URL = '/budgets';

/**
 * Presupuesto del mes: un bloque por moneda con el tope, lo gastado y lo disponible, y una tabla por
 * categoría. Se ve una moneda a la vez, elegida con un filtro. Editar o agregar un tope abre un panel
 * junto a la lista (ruta hija). Mes y moneda viajan en la URL (`?month=YYYY-MM&currency=USD`); un mes
 * cerrado es de solo lectura.
 */
@Component({
  selector: 'app-budget-list-page',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    RouterOutlet,
    TranslocoDirective,
    PeriodOverlaysComponent,
    ReopenPeriodButtonComponent,
    SelectComponent,
    LucideChevronLeft,
    LucideChevronRight,
    LucideLock,
    LucidePlus,
    LucideRepeat,
  ],
  providers: [BudgetWorkspace],
  templateUrl: './budget-list-page.component.html',
  host: { class: 'block' },
})
export class BudgetListPageComponent {
  private readonly getSummary = inject(GetBudgetSummaryUseCase);
  private readonly listCategories = inject(ListBudgetCategoryOptionsUseCase);
  private readonly workspace = inject(BudgetWorkspace);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  protected readonly listUrl = BUDGETS_URL;

  private readonly today = todayInBudgetZone();
  protected readonly currentMonth: BudgetMonth = monthOfDay(this.today);
  protected readonly month = this.workspace.month;
  protected readonly summary = this.workspace.summary;
  protected readonly notice = this.workspace.notice;
  protected readonly selectedKey = this.workspace.selectedKey;
  protected readonly loadError = signal('');
  protected readonly panelOpen = signal(false);
  /** Moneda pedida en la URL (`?currency=USD`); `null` muestra la primera del resumen. */
  private readonly currency = signal<string | null>(null);
  /** Filtro de moneda; refleja `activeCurrency` y al cambiar escribe la URL. */
  protected readonly currencyFilter = new FormControl<string | null>(null);

  /**
   * Idioma activo, emitido cuando el scope `budgets` ya cargó en ese idioma: las etiquetas que se
   * arman con `translate()` (tipo de categoría, notas) no deben calcularse antes, o saldrían las claves.
   */
  private readonly lang = toSignal(
    this.transloco.langChanges$.pipe(
      switchMap((lang) => this.transloco.selectTranslation(`budgets/${lang}`).pipe(map(() => lang))),
    ),
  );

  protected readonly isCurrentMonth = computed(() => compareMonths(this.month(), this.currentMonth) === 0);
  /** Un mes futuro se consulta en solo lectura: muestra los topes y las cuotas ya programadas. */
  protected readonly isFutureMonth = computed(() => compareMonths(this.month(), this.currentMonth) > 0);
  /** Hasta dónde se puede avanzar: el último mes con cuotas posibles. */
  protected readonly isLastViewableMonth = computed(
    () => compareMonths(this.month(), lastViewableMonth(this.currentMonth)) >= 0,
  );
  protected readonly monthTitle = computed(() => monthLabel(this.month(), this.locale()));
  protected readonly monthWord = computed(() => monthName(this.month(), this.locale()));
  /** Mes y moneda de la URL, para que el panel y sus enlaces los conserven. */
  protected readonly monthQuery = computed(() => {
    const query: Record<string, string> = {};
    const currency = this.currency();

    if (!this.isCurrentMonth()) {
      query['month'] = formatMonthKey(this.month());
    }

    if (currency) {
      query['currency'] = currency;
    }

    return query;
  });
  /** Un mes cerrado no se puede editar, y uno futuro solo se consulta. */
  protected readonly editable = computed(() => this.summary()?.isClosed === false && !this.isFutureMonth());

  /** «Quedan 21 días del mes», o que el mes ya terminó; nada en un mes cerrado. */
  protected readonly timeNote = computed<Copy | null>(() => {
    if (this.summary()?.isClosed) {
      return null;
    }

    if (this.isFutureMonth()) {
      return { key: 'budgets.list.month.future' };
    }

    if (!this.isCurrentMonth()) {
      return { key: 'budgets.list.month.ended' };
    }

    const days = daysLeftInMonth(this.today);

    if (days === 0) {
      return { key: 'budgets.list.month.lastDay' };
    }

    return days === 1 ? { key: 'budgets.list.month.daysLeftOne' } : { key: 'budgets.list.month.daysLeft', params: { count: days } };
  });

  private readonly categoriesById = computed(
    () => new Map(this.workspace.categories().map((category) => [category.id, category])),
  );

  protected readonly blocks = computed<BlockView[]>(() => {
    const summary = this.summary();
    this.lang();

    if (!summary) {
      return [];
    }

    const locale = this.locale();

    return blocksOf(summary).map(({ currency, total, rows }) => {
      const percent = totalPercent(total);

      return {
        currency,
        budget: formatMoney(total.budget, currency, locale),
        spent: formatMoney(total.spent, currency, locale),
        available: formatMoney(total.available, currency, locale),
        tone: toneOf(total.available),
        percent,
        installmentsSpent: total.installmentsSpent > 0 ? formatMoney(total.installmentsSpent, currency, locale) : null,
        bar: percent === null ? 0 : Math.min(100, percent),
        rows: rows.map((row) => this.toView(row, !summary.isClosed, this.isFutureMonth())),
      };
    });
  });

  /** Moneda visible: la de la URL si el mes la tiene; si no, la primera (pesos). */
  protected readonly activeCurrency = computed(() => {
    const blocks = this.blocks();
    const chosen = this.currency();

    return blocks.some((block) => block.currency === chosen) ? chosen : (blocks[0]?.currency ?? null);
  });

  /** El único bloque que se pinta: el de la moneda visible. */
  protected readonly activeBlock = computed(
    () => this.blocks().find((block) => block.currency === this.activeCurrency()) ?? null,
  );

  /** Opciones del filtro: las monedas con topes o gasto en el mes. */
  protected readonly currencyOptions = computed<SelectOption<string>[]>(() => {
    this.lang();

    return this.blocks().map((block) => ({
      value: block.currency,
      label: `${this.transloco.translate(`budgets.list.currency.name.${block.currency}`)} · ${block.currency}`,
    }));
  });

  protected readonly noticeCopy = computed<Copy | null>(() => {
    const notice = this.notice();

    return notice ? { key: `budgets.list.notice.${notice.kind}`, params: { name: notice.name } } : null;
  });

  private request: Subscription | null = null;

  constructor() {
    let first = true;

    // Abrir o cerrar el panel también navega: solo se recarga si cambia el mes.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.currency.set(params.get('currency'));
      const next = this.readMonth(params.get('month'));

      if (!first && compareMonths(next, this.month()) === 0) {
        return;
      }

      // El aviso de la última acción es de otro mes.
      if (!first) {
        this.notice.set(null);
      }

      first = false;
      this.month.set(next);
      this.load();
    });

    this.workspace.changed$.pipe(takeUntilDestroyed()).subscribe(() => this.load(true));
    // Reabrir o cerrar un mes cambia si sus topes se pueden editar.
    injectPeriodChanges()
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load(true));

    // El filtro muestra siempre la moneda visible, aunque la URL pida una que el mes no tiene.
    effect(() => {
      const active = this.activeCurrency();
      untracked(() => this.currencyFilter.setValue(active, { emitEvent: false }));
    });

    this.currencyFilter.valueChanges.pipe(takeUntilDestroyed()).subscribe((currency) => this.chooseCurrency(currency));

    this.listCategories
      .execute()
      .pipe(
        catchError(() => of<BudgetCategoryOption[]>([])),
        takeUntilDestroyed(),
      )
      .subscribe((categories) => this.workspace.categories.set(categories));
  }

  protected previousMonth(): void {
    this.goToMonth(shiftMonth(this.month(), -1));
  }

  protected nextMonth(): void {
    if (!this.isLastViewableMonth()) {
      this.goToMonth(shiftMonth(this.month(), 1));
    }
  }

  protected retry(): void {
    this.load();
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  /** Ruta del panel de una fila: `/budgets/{categoría}/{moneda}`. */
  protected editLink(row: BudgetRow): (string | number)[] {
    return [BUDGETS_URL, row.categoryId, row.currency];
  }

  /** Al recargar tras un cambio se conserva el resumen anterior para no parpadear. */
  private load(keep = false): void {
    if (!keep) {
      this.summary.set(null);
    }

    this.loadError.set('');
    this.request?.unsubscribe();
    this.request = this.getSummary.execute(this.month()).subscribe({
      next: (summary) => this.summary.set(summary),
      error: (error: unknown) => {
        this.summary.set(null);
        this.loadError.set(this.messageOf(error));
      },
    });
  }

  private goToMonth(month: BudgetMonth): void {
    const value = compareMonths(month, this.currentMonth) === 0 ? null : formatMonthKey(month);
    // Cambiar de mes cierra el panel (lo que muestra es de otro mes), pero conserva la moneda.
    void this.router.navigate([BUDGETS_URL], { queryParams: { month: value, currency: this.currency() } });
  }

  /** Escribe la moneda en la URL sin cerrar el panel; la primera (pesos) no se escribe. */
  private chooseCurrency(currency: string | null): void {
    const first = this.blocks()[0]?.currency ?? null;
    const value = currency === null || currency === first ? null : currency;

    void this.router.navigate([], { queryParams: { currency: value }, queryParamsHandling: 'merge' });
  }

  /** Mes de la URL; uno inválido o más allá del último consultable cae al mes en curso. */
  private readMonth(value: string | null): BudgetMonth {
    const month = parseMonth(value);

    return month && compareMonths(month, lastViewableMonth(this.currentMonth)) <= 0 ? month : this.currentMonth;
  }

  private toView(row: BudgetRow, openMonth: boolean, futureMonth: boolean): RowView {
    const locale = this.locale();
    const category = this.categoriesById().get(row.categoryId);
    const inactive = category?.isActive === false;
    const usage = usageOf(row);
    const money = (amount: number) => formatMoney(amount, row.currency, locale);
    const type = this.transloco.translate(`budgets.list.type.${row.categoryType ?? 'unknown'}`);
    const percent = `${Math.round(row.percentUsed ?? (row.budgetAmount > 0 ? (row.spentAmount / row.budgetAmount) * 100 : 0))} %`;

    const source: Copy = {
      key:
        usage === 'paused'
          ? 'budgets.list.source.paused'
          : row.installmentsRaise > 0
            ? 'budgets.list.source.raisedByInstallments'
            : `budgets.list.source.${row.source}`,
    };
    const purchases = installmentPurchases(row).length;
    const note: Copy =
      usage === 'unbudgeted'
        ? { key: 'budgets.list.usage.unbudgeted', params: { spent: money(row.spentAmount) } }
        : usage === 'over'
          ? { key: 'budgets.list.usage.over', params: { amount: money(Math.abs(row.availableAmount)) } }
          : usage === 'partial'
            ? { key: 'budgets.list.usage.partial', params: { percent } }
            : { key: `budgets.list.usage.${usage}` };
    const shortNote: Copy =
      usage === 'partial' ? { key: 'budgets.list.shortUsage.partial', params: { percent } } : { key: `budgets.list.shortUsage.${usage}` };

    let meta =
      usage === 'paused'
        ? this.transloco.translate(source.key)
        : usage === 'unbudgeted'
        ? this.transloco.translate('budgets.list.mobileMeta.unbudgeted', { spent: money(row.spentAmount) })
        : this.transloco.translate('budgets.list.mobileMeta.budgeted', { spent: money(row.spentAmount), budget: money(row.budgetAmount) });

    if (row.source === 'month' && usage !== 'paused' && usage !== 'unbudgeted') {
      meta += ` · ${this.transloco.translate(source.key).toLocaleLowerCase(locale)}`;
    }

    return {
      key: rowKey(row.categoryId, row.currency),
      row,
      kind: inactive ? `${type} · ${this.transloco.translate('budgets.list.inactive')}` : type,
      source,
      usage,
      note,
      shortNote,
      meta,
      bar: barPercent(row),
      budget: money(row.budgetAmount),
      spent: money(row.spentAmount),
      available: money(row.availableAmount),
      tone: toneOf(row.availableAmount),
      editable: openMonth && !inactive && row.categoryType !== null,
      viewOnly: futureMonth,
      installmentsChip: purchases > 0 ? { key: 'budgets.list.installmentsChip', params: { count: purchases } } : null,
    };
  }

  private messageOf(error: unknown): string {
    return error instanceof BudgetError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}

function toneOf(available: number): Tone {
  if (available < 0) {
    return 'text';
  }

  return available === 0 ? 'muted' : 'accent';
}
