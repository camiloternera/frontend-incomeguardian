import { formatCurrency, formatDate, formatPercent } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import { formatMoney } from '@shared/money/money-format';
import { LucideArrowDownLeft, LucideArrowLeftRight, LucideArrowUpRight, LucideEye, LucideEyeOff, LucidePlus } from '@lucide/angular';
import { LanguageService } from '@core/i18n/language.service';
import {
  ClosedMonthBadgeComponent,
  PeriodBannerComponent,
  PeriodOverlaysComponent,
  PeriodSelectorComponent,
} from '@features/periods';
import { ThemeService } from '@core/theme/theme.service';
import { GetMonthSummaryUseCase } from '../../../application/get-month-summary.use-case';
import { GetCushionUseCase } from '../../../application/cushion-use-cases';
import { GetRecentMovementsUseCase } from '../../../application/get-recent-movements.use-case';
import { CategorySpent, MonthSummary, monthKey, monthOfDay, todayInDashboardZone } from '../../../domain/month-summary';
import { groupByDay, monthOutlook, previousAverages } from '../../../domain/overview-insights';
import { RecentMovement } from '../../../domain/recent-movement';
import { CashFlowBar, CashFlowChartComponent } from '../../components/cash-flow-chart.component';
import { CushionCardComponent, CushionLoad } from '../../components/cushion-card/cushion-card.component';
import { CushionSheetComponent } from '../../components/cushion-sheet/cushion-sheet.component';

/** Texto que reemplaza un monto cuando el usuario decide ocultarlos. */
const MASK = '•••••';

/** Categoría del mes con su parte del gasto, de 0 a 1. */
interface CategoryShare extends CategorySpent {
  share: number;
}

/** Categorías que «En qué se fue» muestra antes de desplazarse. */
const VISIBLE_CATEGORIES = 5;

/** Estado de las cifras reales del mes que alimentan el bloque principal. */
type SummaryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: MonthSummary };

/** Estado de «Movimientos recientes», que carga aparte del bloque principal. */
type RecentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; movements: RecentMovement[] };

@Component({
  selector: 'app-home-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    SelectComponent,
    TranslocoDirective,
    CashFlowChartComponent,
    CushionCardComponent,
    CushionSheetComponent,
    ClosedMonthBadgeComponent,
    PeriodBannerComponent,
    PeriodOverlaysComponent,
    PeriodSelectorComponent,
    LucideArrowDownLeft,
    LucideArrowLeftRight,
    LucideArrowUpRight,
    LucideEye,
    LucideEyeOff,
    LucidePlus,
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css'],
})
export class HomePageComponent {
  private readonly getCushion = inject(GetCushionUseCase);
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);
  private readonly getMonthSummary = inject(GetMonthSummaryUseCase);
  private readonly getRecentMovements = inject(GetRecentMovementsUseCase);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly theme = this.themeService.theme;
  protected readonly locale = this.languageService.language;

  /** «Tu colchón», que carga aparte del bloque principal. */
  protected readonly cushionState = signal<CushionLoad>({ status: 'loading' });

  /** El colchón cargado, para la hoja; `null` mientras carga o si falló. */
  protected readonly readyCushion = computed(() => {
    const state = this.cushionState();

    return state.status === 'ready' ? state.cushion : null;
  });

  /** Si la hoja para elegir cuentas y meta está abierta. */
  protected readonly cushionSheetOpen = signal(false);

  /** Si los montos se muestran enmascarados (por ejemplo, en un lugar público). */
  protected readonly amountsHidden = signal(false);

  /** Hoy en la hora de Colombia: define el mes del bloque principal y los días que quedan. */
  protected readonly today = todayInDashboardZone();

  /** Cifras reales del mes en curso, por moneda. */
  protected readonly summaryState = signal<SummaryState>({ status: 'loading' });

  /** Últimos movimientos del usuario, de cualquier mes. */
  protected readonly recentState = signal<RecentState>({ status: 'loading' });

  /** Moneda pedida en `?currency=`; `null` muestra la primera disponible. */
  private readonly currency = signal<string | null>(null);

  /** Desplegable de moneda junto al monto disponible. */
  protected readonly currencyFilter = new FormControl<string | null>(null);

  private readonly currencies = computed(() => {
    const state = this.summaryState();

    // Los pesos van primero: son la moneda por defecto del Resumen.
    return state.status === 'ready'
      ? [...state.summary.currencies].sort((a, b) => Number(b.currency === 'COP') - Number(a.currency === 'COP'))
      : [];
  });

  /** La moneda pedida si el mes la tiene; si no, la primera (COP primero cuando existe). */
  protected readonly activeCurrency = computed(() => {
    const currencies = this.currencies();
    const chosen = this.currency();

    return currencies.some((item) => item.currency === chosen) ? chosen : (currencies[0]?.currency ?? null);
  });

  /** Cifras del mes en la moneda activa; `null` si el mes no tiene movimientos ni topes. */
  protected readonly activeFigures = computed(() => this.currencies().find((item) => item.currency === this.activeCurrency()) ?? null);

  protected readonly currencyOptions = computed<SelectOption<string>[]>(() => {
    this.locale();

    return this.currencies().map((item) => ({
      value: item.currency,
      label: `${this.transloco.translate(`dashboard.home.hero.currency.${item.currency}`)} · ${item.currency}`,
    }));
  });

  /** Disponible del mes en la moneda activa, su reparto y el monto por día. */
  protected readonly outlook = computed(() => {
    const figures = this.activeFigures();

    return figures
      ? monthOutlook({
          month: monthKey(monthOfDay(this.today)),
          asOf: this.today,
          income: figures.income,
          expenses: figures.spent,
          committed: figures.committed,
        })
      : null;
  });

  /** Si el mes en la moneda activa no tiene nada que mostrar todavía. */
  protected readonly isEmpty = computed(() => {
    const figures = this.activeFigures();

    return !figures || (figures.income === 0 && figures.spent === 0 && figures.committed === 0);
  });

  /** Último día del mes en curso, para el título «Disponible hasta el …». */
  protected readonly monthEnd = computed(() => {
    const { year, month } = monthOfDay(this.today);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return `${monthKey({ year, month })}-${String(lastDay).padStart(2, '0')}`;
  });

  /** Frase del resumen según haya uno o varios pagos y algo comprometido en los topes. */
  protected readonly summaryKey = computed(() => {
    const figures = this.activeFigures();
    const base = figures?.incomePayments === 1 ? 'summaryOnePayment' : 'summary';
    const suffix = figures && figures.committed > 0 ? '' : 'NoCommitted';

    return `dashboard.home.hero.${base}${suffix}`;
  });

  /**
   * Por qué el mes se pasa: `overspent` si lo gastado ya supera lo recibido; `overplanned` si aún
   * no, pero lo que falta de los topes lo haría (por ejemplo, un tope en dólares sin gastar ni ingresos).
   */
  protected readonly overKind = computed<'overspent' | 'overplanned'>(() => {
    const figures = this.activeFigures();

    return figures && figures.spent > figures.income ? 'overspent' : 'overplanned';
  });

  /** El desplegable solo aparece cuando el mes tiene más de una moneda. */
  protected readonly hasManyCurrencies = computed(() => this.currencies().length > 1);

  /** Historial real de la moneda activa con la forma `yyyy-MM` que usan los promedios. */
  private readonly cashFlow = computed(() =>
    (this.activeFigures()?.history ?? []).map((point) => ({
      month: monthKey(point),
      income: point.income,
      expenses: point.spent,
    })),
  );

  /** Promedios de los meses anteriores al actual en el historial real; `null` si no hay ninguno. */
  protected readonly averages = computed(() =>
    previousAverages({ month: monthKey(monthOfDay(this.today)), cashFlow: this.cashFlow() }),
  );

  /** Categorías del mes con su parte del gasto, en el orden del backend (de mayor a menor). */
  protected readonly categoryShares = computed<CategoryShare[]>(() => {
    const categories = this.activeFigures()?.categories ?? [];
    const total = categories.reduce((sum, category) => sum + category.spent, 0);

    return categories.map((category) => ({ ...category, share: total > 0 ? category.spent / total : 0 }));
  });

  protected readonly visibleCategories = VISIBLE_CATEGORIES;

  /** Movimientos recientes agrupados por día, con «Hoy» y «Ayer» respecto a hoy en Colombia. */
  protected readonly days = computed(() => {
    const state = this.recentState();

    return state.status === 'ready' ? groupByDay(state.movements, this.today) : [];
  });

  protected readonly bars = computed<CashFlowBar[]>(() =>
    this.cashFlow().map((point) => ({
      label: formatDate(`${point.month}-01T00:00:00`, 'LLL', this.locale()),
      income: point.income,
      expenses: point.expenses,
    })),
  );

  /** Marcas cortas del eje (4 M, 4M); vacías cuando los montos están ocultos. */
  protected readonly formatTick = computed(() => {
    const hidden = this.amountsHidden();
    const format = new Intl.NumberFormat(this.locale(), { notation: 'compact', maximumFractionDigits: 1 });

    return (value: number): string => (hidden ? '' : format.format(value));
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => this.currency.set(params.get('currency')));

    effect(() => this.currencyFilter.setValue(this.activeCurrency(), { emitEvent: false }));

    this.currencyFilter.valueChanges.pipe(takeUntilDestroyed()).subscribe((currency) => this.chooseCurrency(currency));

    this.loadSummary();
    this.loadRecent();
    this.loadCushion();
  }

  /** Pide el colchón; también sirve de reintento y de recarga tras guardar la hoja. */
  protected loadCushion(): void {
    this.cushionState.set({ status: 'loading' });
    this.getCushion.execute().subscribe({
      next: (cushion) => this.cushionState.set({ status: 'ready', cushion }),
      error: (error: unknown) =>
        this.cushionState.set({
          status: 'error',
          message: error instanceof Error ? error.message : this.transloco.translate('errors.generic'),
        }),
    });
  }

  protected openCushionSheet(): void {
    this.cushionSheetOpen.set(true);
  }

  protected onCushionSaved(): void {
    this.cushionSheetOpen.set(false);
    this.loadCushion();
  }

  /** Pide las cifras del mes en curso; también sirve de reintento tras un error. */
  protected loadSummary(): void {
    this.summaryState.set({ status: 'loading' });
    this.getMonthSummary.execute(monthOfDay(this.today)).subscribe({
      next: (summary) => this.summaryState.set({ status: 'ready', summary }),
      error: (error: unknown) =>
        this.summaryState.set({
          status: 'error',
          message: error instanceof Error ? error.message : this.transloco.translate('errors.generic'),
        }),
    });
  }

  /** Pide los últimos movimientos; también sirve de reintento tras un error. */
  protected loadRecent(): void {
    this.recentState.set({ status: 'loading' });
    this.getRecentMovements.execute().subscribe({
      next: (movements) => this.recentState.set({ status: 'ready', movements }),
      error: (error: unknown) =>
        this.recentState.set({
          status: 'error',
          message: error instanceof Error ? error.message : this.transloco.translate('errors.generic'),
        }),
    });
  }

  /** Título de un movimiento sin descripción: su categoría, o el tipo si no tiene. */
  protected movementLabel(movement: RecentMovement): string {
    if (movement.isCardPayment) {
      return this.transloco.translate('dashboard.home.recent.cardPayment');
    }

    if (movement.isCardAdvance) {
      return this.transloco.translate('dashboard.home.recent.advance');
    }

    if (movement.isAdvanceFee) {
      return this.transloco.translate('dashboard.home.recent.advanceFee');
    }

    return movement.categoryName ?? this.transloco.translate(`dashboard.home.recent.${movement.kind}`);
  }

  /**
   * Línea secundaria: «Origen → Destino» en una transferencia (con sus cuotas si es un avance);
   * «Categoría · Cuenta» en los demás.
   */
  protected movementMeta(movement: RecentMovement): string {
    const installments =
      movement.installments > 1
        ? this.transloco.translate('dashboard.home.recent.installments', { count: movement.installments })
        : null;

    if (movement.kind === 'transfer') {
      const route = this.transloco.translate('dashboard.home.recent.route', {
        from: movement.fromAccountName ?? '',
        to: movement.toAccountName ?? '',
      });

      return [route, installments].filter(Boolean).join(' · ');
    }

    const account = movement.kind === 'income' ? movement.toAccountName : movement.fromAccountName;

    return [movement.categoryName, account, installments].filter(Boolean).join(' · ');
  }

  /** Lleva la moneda a la URL; la primera disponible no se escribe, como el mes actual. */
  private chooseCurrency(currency: string | null): void {
    const first = this.currencies()[0]?.currency ?? null;
    const value = currency === null || currency === first ? null : currency;

    void this.router.navigate([], { queryParams: { currency: value }, queryParamsHandling: 'merge' });
  }

  /** Formatea un monto en la moneda activa del bloque principal, o lo enmascara. */
  protected heroMoney(value: number): string {
    const formatted = this.money(value, false, this.activeCurrency() ?? 'COP');

    // Signo menos tipográfico (−) en lugar del guion, que en el número grande se ve corto.
    return formatted.replace(/^-/, '−');
  }

  /** Monto corto en la moneda activa ($5,2 M), para la leyenda del promedio. */
  protected compactMoney(value: number): string {
    return this.money(value, true, this.activeCurrency() ?? 'COP');
  }

  /** Formatea un monto en la moneda del resumen, o lo enmascara si están ocultos. */
  protected money(value: number, compact = false, currencyCode?: string): string {
    if (this.amountsHidden()) {
      return MASK;
    }

    const currency = currencyCode ?? 'COP';

    if (compact) {
      const format = new Intl.NumberFormat(this.locale(), { style: 'currency', currency, currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1 });
      return format.format(value);
    }

    // Los pesos no usan centavos; en otras monedas, si los hay, se muestran completos (899,50, no 899,5).
    const hasCents = currency !== 'COP' && !Number.isInteger(value);

    return formatCurrency(value, this.locale(), '$', currency, hasCents ? '1.2-2' : '1.0-0');
  }

  /** Monto de un movimiento con el símbolo de su moneda (US$ en dólares), igual que el listado de movimientos. */
  protected movementMoney(value: number, currency: string): string {
    if (this.amountsHidden()) {
      return MASK;
    }

    const hasCents = currency !== 'COP' && !Number.isInteger(value);

    return formatMoney(value, currency, this.locale(), hasCents ? '1.2-2' : '1.0-0');
  }

  /** Porcentaje con hasta un decimal en el idioma activo. */
  protected percent(value: number): string {
    return formatPercent(value, this.locale(), '1.0-1');
  }

  /** Fecha larga de un día: «viernes 17 de octubre» / «Friday, October 17». */
  protected longDate(date: string): string {
    const pattern = this.isSpanish() ? "EEEE d 'de' MMMM" : 'EEEE, MMMM d';

    return formatDate(`${date}T00:00:00`, pattern, this.locale());
  }

  /** Día y mes: «31 de octubre» / «October 31». */
  protected shortDate(date: string): string {
    const pattern = this.isSpanish() ? "d 'de' MMMM" : 'MMMM d';

    return formatDate(`${date}T00:00:00`, pattern, this.locale());
  }

  /** Solo la primera letra en mayúscula («Sábado 17 de octubre»), a diferencia de `capitalize`. */
  protected capitalized(text: string): string {
    return text.charAt(0).toLocaleUpperCase(this.locale()) + text.slice(1);
  }

  private isSpanish(): boolean {
    return this.locale().startsWith('es');
  }

  protected toggleAmounts(): void {
    this.amountsHidden.update((hidden) => !hidden);
  }
}
