import { formatCurrency, formatDate, formatNumber, formatPercent } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowDownLeft, LucideArrowUpRight, LucideEye, LucideEyeOff, LucidePlus, LucideShield } from '@lucide/angular';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { GetOverviewUseCase } from '../../../application/get-overview.use-case';
import { cushionMonths, groupByDay, monthOutlook, previousAverages, projectedSavingsRate } from '../../../domain/overview-insights';
import { CashFlowBar, CashFlowChartComponent } from '../../components/cash-flow-chart.component';

/** Texto que reemplaza un monto cuando el usuario decide ocultarlos. */
const MASK = '•••••';

/** Segmentos de la meta del colchón: uno por mes, con el relleno de 0 a 1. */
interface MeterSegment {
  index: number;
  fill: number;
}

@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    CashFlowChartComponent,
    LucideArrowDownLeft,
    LucideArrowUpRight,
    LucideEye,
    LucideEyeOff,
    LucidePlus,
    LucideShield,
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css'],
})
export class HomePageComponent {
  private readonly getOverview = inject(GetOverviewUseCase);
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);

  protected readonly theme = this.themeService.theme;
  protected readonly locale = this.languageService.language;

  protected readonly overview = toSignal(this.getOverview.execute(), { initialValue: null });

  /** Si los montos se muestran enmascarados (por ejemplo, en un lugar público). */
  protected readonly amountsHidden = signal(false);

  protected readonly outlook = computed(() => {
    const overview = this.overview();

    return overview ? monthOutlook(overview) : null;
  });

  protected readonly averages = computed(() => {
    const overview = this.overview();

    return overview ? previousAverages(overview) : null;
  });

  protected readonly cushion = computed(() => {
    const overview = this.overview();
    const averages = this.averages();

    return overview && averages ? cushionMonths(overview.savings, averages.expenses) : null;
  });

  protected readonly savingsRate = computed(() => {
    const overview = this.overview();

    return overview ? projectedSavingsRate(overview) : null;
  });

  protected readonly days = computed(() => {
    const overview = this.overview();

    return overview ? groupByDay(overview.recent, overview.asOf) : [];
  });

  /** Un segmento por mes de la meta; el colchón llena los primeros. */
  protected readonly meter = computed<MeterSegment[]>(() => {
    const goal = this.overview()?.goals.cushionMonths ?? 0;
    const months = this.cushion() ?? 0;

    return Array.from({ length: goal }, (_, index) => ({
      index,
      fill: Math.min(1, Math.max(0, months - index)),
    }));
  });

  protected readonly monthLabel = computed(() => {
    const month = this.overview()?.month;

    return month ? formatDate(`${month}-01T00:00:00`, 'LLLL yyyy', this.locale()) : '';
  });

  protected readonly bars = computed<CashFlowBar[]>(() =>
    (this.overview()?.cashFlow ?? []).map((point) => ({
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

  /** Formatea un monto en la moneda del resumen, o lo enmascara si están ocultos. */
  protected money(value: number, compact = false): string {
    if (this.amountsHidden()) {
      return MASK;
    }

    const currency = this.overview()?.currency ?? 'COP';

    if (compact) {
      const format = new Intl.NumberFormat(this.locale(), { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
      return format.format(value);
    }

    return formatCurrency(value, this.locale(), '$', currency, '1.0-0');
  }

  /** Porcentaje con hasta un decimal en el idioma activo. */
  protected percent(value: number): string {
    return formatPercent(value, this.locale(), '1.0-1');
  }

  /** Número con un decimal, para los meses del colchón. */
  protected decimal(value: number): string {
    return formatNumber(value, this.locale(), '1.1-1');
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
