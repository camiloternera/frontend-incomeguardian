import { CurrencyPipe, DatePipe, PercentPipe, formatDate } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { GetOverviewUseCase } from '../../../application/get-overview.use-case';
import { CashFlowBar, CashFlowChartComponent } from '../../components/cash-flow-chart.component';

interface Kpi {
  key: string;
  value: number;
  /** A ratio for the money tiles, percentage points for the savings rate. */
  change: number;
  isRate: boolean;
  /** Whether the move is the welcome direction, which decides the accent. */
  good: boolean;
}

@Component({
  selector: 'app-home-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    PercentPipe,
    TranslocoDirective,
    CashFlowChartComponent,
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

  protected readonly currency = computed(() => this.overview()?.currency ?? 'COP');

  protected readonly monthDate = computed(() => {
    const month = this.overview()?.month;

    return month ? new Date(`${month}-01T00:00:00`) : null;
  });

  protected readonly bars = computed<CashFlowBar[]>(() =>
    (this.overview()?.cashFlow ?? []).map((point) => ({
      label: formatDate(`${point.month}-01T00:00:00`, 'LLL', this.locale()),
      income: point.income,
      expenses: point.expenses,
    })),
  );

  /** Short axis ticks (4K, 4 mil) so the scale reads in the active language. */
  protected readonly formatTick = computed(() => {
    const format = new Intl.NumberFormat(this.locale(), {
      notation: 'compact',
      maximumFractionDigits: 1,
    });

    return (value: number): string => format.format(value);
  });

  protected readonly kpis = computed<Kpi[]>(() => {
    const totals = this.overview()?.totals;

    if (!totals) {
      return [];
    }

    return [
      { key: 'balance', value: totals.balance, change: totals.balanceChange, isRate: false, good: totals.balanceChange >= 0 },
      { key: 'income', value: totals.income, change: totals.incomeChange, isRate: false, good: totals.incomeChange >= 0 },
      // Spending more is not the welcome direction, so a rise stays muted.
      { key: 'expenses', value: totals.expenses, change: totals.expensesChange, isRate: false, good: totals.expensesChange < 0 },
      { key: 'savingsRate', value: totals.savingsRate, change: totals.savingsRateChange, isRate: true, good: totals.savingsRateChange >= 0 },
    ];
  });
}
