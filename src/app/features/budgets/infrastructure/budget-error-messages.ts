import { BudgetErrorCode } from '../domain/budget-error';

/** Cada código conocido del backend para presupuestos, asociado a su clave de traducción. */
export const BUDGET_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(BudgetErrorCode).map((code) => [code, `budgets.errors.${code}`]),
);
