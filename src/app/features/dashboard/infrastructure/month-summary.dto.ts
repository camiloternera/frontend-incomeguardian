/** Un mes del historial de ingreso y gasto. */
export interface MonthFlowDto {
  year: number;
  month: number;
  income: number;
  spent: number;
}

/** Gasto de una categoría en el mes. */
export interface CategorySpentDto {
  categoryId: number;
  name: string;
  type: string;
  spent: number;
}

/** Cifras de una moneda en `GET /api/v1/dashboard/summary`. */
export interface CurrencyMonthDto {
  currency: string;
  income: number;
  incomePayments: number;
  spent: number;
  committed: number;
  history?: MonthFlowDto[] | null;
  categories?: CategorySpentDto[] | null;
}

/** Respuesta de `GET /api/v1/dashboard/summary?year&month`. */
export interface MonthSummaryDto {
  year: number;
  month: number;
  currencies?: CurrencyMonthDto[] | null;
}
