/** Forma de los datos de `/api/v1/periods` tal como los serializa el backend (camelCase). */

export interface PeriodMonthDto {
  month: number;
  status: string;
  closedAt: string | null;
  closedAutomatically: boolean;
  reopenedAt: string | null;
  recloseMode: string | null;
  recloseAt: string | null;
  autoCloseOn: string | null;
  canClose: boolean;
  canReopen: boolean;
}

export interface PeriodYearDto {
  year: number;
  yearClosed: boolean;
  yearClosedAt: string | null;
  yearClosedAutomatically: boolean;
  canCloseYear: boolean;
  canReopenYear: boolean;
  firstActivity: string | null;
  months: PeriodMonthDto[];
}

export interface PeriodTotalsDto {
  currency: string;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number | null;
}

export interface PeriodAccountBalanceDto {
  accountId: number;
  name: string;
  currency: string;
  balance: number;
  isActive: boolean;
}

export interface MonthReviewDto {
  year: number;
  state: PeriodMonthDto;
  totals: PeriodTotalsDto[];
  balances: PeriodAccountBalanceDto[];
  uncategorizedCount: number;
}

export interface YearReviewDto {
  state: PeriodYearDto;
  totals: PeriodTotalsDto[];
  balances: PeriodAccountBalanceDto[];
  uncategorizedCount: number;
}

export interface PendingPeriodDto {
  year: number;
  month: number;
  endedOn: string;
  autoCloseOn: string | null;
  canClose: boolean;
}

export interface PeriodLogDto {
  year: number;
  /** 0 cuando el evento es del año completo. */
  month: number;
  action: string;
  automatic: boolean;
  reason: string | null;
  createdAt: string;
}

export interface PeriodClosingSettingsDto {
  autoCloseEnabled: boolean;
  autoCloseDay: number;
  closeYearWithDecember: boolean;
  remindOnMonthEnd: boolean;
}

export interface ReopenMonthRequestDto {
  recloseMode: string;
  reason: string | null;
}

export interface ReopenYearRequestDto {
  reason: string | null;
}
