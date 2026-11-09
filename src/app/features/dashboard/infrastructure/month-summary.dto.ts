/** Cifras de una moneda en `GET /api/v1/dashboard/summary`. */
export interface CurrencyMonthDto {
  currency: string;
  income: number;
  incomePayments: number;
  spent: number;
  committed: number;
}

/** Respuesta de `GET /api/v1/dashboard/summary?year&month`. */
export interface MonthSummaryDto {
  year: number;
  month: number;
  currencies?: CurrencyMonthDto[] | null;
}
