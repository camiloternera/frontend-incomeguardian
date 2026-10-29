export type MovementKind = 'income' | 'expense';

/** Spending buckets. The key names a translation, never the copy itself. */
export type CategoryKey =
  | 'housing'
  | 'food'
  | 'transport'
  | 'subscriptions'
  | 'health'
  | 'other';

export interface OverviewTotals {
  balance: number;
  income: number;
  expenses: number;
  /** Share of the income kept this month, 0 to 1. */
  savingsRate: number;
  /** Ratios against the previous month, 0.062 meaning 6.2% up. */
  balanceChange: number;
  incomeChange: number;
  expensesChange: number;
  /** Difference in percentage points, not a ratio. */
  savingsRateChange: number;
}

export interface CashFlowPoint {
  /** ISO year and month, such as `2026-10`. */
  month: string;
  income: number;
  expenses: number;
}

export interface CategorySpend {
  key: CategoryKey;
  amount: number;
  /** Share of the month's spending, 0 to 1. */
  share: number;
}

export interface MovementSummary {
  id: string;
  /** ISO date, such as `2026-10-16`. */
  date: string;
  description: string;
  category: CategoryKey | 'salary' | 'freelance' | 'investment';
  account: string;
  amount: number;
  kind: MovementKind;
}

export interface DashboardOverview {
  month: string;
  currency: string;
  totals: OverviewTotals;
  cashFlow: CashFlowPoint[];
  categories: CategorySpend[];
  recent: MovementSummary[];
}
