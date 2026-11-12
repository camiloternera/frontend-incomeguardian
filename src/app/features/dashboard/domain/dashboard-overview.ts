/** Grupos de gasto. La clave nombra una traducción, nunca el copy. */
export type CategoryKey =
  | 'housing'
  | 'food'
  | 'transport'
  | 'subscriptions'
  | 'health'
  | 'other';

export interface CashFlowPoint {
  /** Año y mes ISO, por ejemplo `2026-10`. */
  month: string;
  income: number;
  expenses: number;
}

export interface CategorySpend {
  key: CategoryKey;
  amount: number;
  /** Parte del gasto del mes, de 0 a 1. */
  share: number;
}

/** Metas del usuario contra las que se comparan los indicadores. */
export interface OverviewGoals {
  /** Tasa de ahorro deseada, de 0 a 1. */
  savingsRate: number;
  /** Meses de gastos que el colchón debería cubrir. */
  cushionMonths: number;
}

export interface DashboardOverview {
  /** Mes del resumen, año y mes ISO. */
  month: string;
  /** Día al que corresponden los datos, fecha ISO dentro de `month`. */
  asOf: string;
  currency: string;
  /** Ingreso recibido en el mes. */
  income: number;
  /** Cuántos pagos componen ese ingreso. */
  incomePayments: number;
  /** Gastado en el mes hasta `asOf`. */
  expenses: number;
  /** Gastos fijos del mes que aún faltan por pagar. */
  committed: number;
  /** Dinero ahorrado disponible como colchón. */
  savings: number;
  goals: OverviewGoals;
  /** Últimos meses, incluido el actual, del más antiguo al más reciente. */
  cashFlow: CashFlowPoint[];
  categories: CategorySpend[];
}
