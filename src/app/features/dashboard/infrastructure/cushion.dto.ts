/** Formas exactas de la API para «Tu colchón». Nunca salen de esta capa. */

export interface CushionAccountDto {
  id: number;
  name: string;
  balance: number;
}

export interface CushionCurrencyDto {
  currency: string;
  savings: number;
  averageMonthlySpent: number;
  monthsUsed: number;
  monthsCovered: number | null;
  /** `NO_PREVIOUS_MONTHS` o `NO_SPENDING` cuando `monthsCovered` es null. */
  monthsCoveredReason: string | null;
  goalAmount: number | null;
  missing: number | null;
  accounts: CushionAccountDto[] | null;
}

/** `GET /api/v1/dashboard/cushion`. */
export interface CushionDto {
  goalMonths: number;
  hasCushionAccounts: boolean;
  currencies: CushionCurrencyDto[] | null;
}

/** Lo que la hoja necesita de `GET /api/v1/accounts`. */
export interface CushionAccountListItemDto {
  id: number;
  name: string;
  kind?: string | null;
  currency: string;
  currentBalance: number | null;
  initialBalance: number;
  isActive: boolean;
  isCushion?: boolean | null;
}

/** `GET/PUT /api/v1/User/preferences`. */
export interface CushionPreferencesDto {
  theme: string;
  language: string;
  cushionGoalMonths?: number | null;
}
