/**
 * Códigos de negocio que envía el backend para presupuestos, escritos tal cual los envía.
 * Comparar contra estas constantes en lugar de escribir los textos a mano.
 */
export const BudgetErrorCode = {
  AmountInvalid: 'BUDGET_AMOUNT_INVALID',
  CurrencyUnsupported: 'BUDGET_CURRENCY_UNSUPPORTED',
  CategoryTypeInvalid: 'BUDGET_CATEGORY_TYPE_INVALID',
  CategoryNotFound: 'BUDGET_CATEGORY_NOT_FOUND',
  NotFound: 'BUDGET_NOT_FOUND',
  CategoryRequired: 'BUDGET_CATEGORY_REQUIRED',
  PeriodInvalid: 'PERIOD_INVALID',
  /** El mes está cerrado: sus topes no se pueden cambiar. */
  PeriodClosed: 'PERIOD_CLOSED',
} as const;

export type BudgetErrorCode = (typeof BudgetErrorCode)[keyof typeof BudgetErrorCode];

const KNOWN_CODES: readonly string[] = Object.values(BudgetErrorCode);

/** Indica si el código recibido es uno de los que conoce este dominio. */
export function isBudgetErrorCode(code: string | undefined): code is BudgetErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

/** Códigos que pertenecen a un campo del formulario, para mostrarlos junto a él. */
export const AMOUNT_ERROR_CODES: readonly BudgetErrorCode[] = [BudgetErrorCode.AmountInvalid];

export const CATEGORY_ERROR_CODES: readonly BudgetErrorCode[] = [
  BudgetErrorCode.CategoryTypeInvalid,
  BudgetErrorCode.CategoryNotFound,
  BudgetErrorCode.CategoryRequired,
];

export const CURRENCY_ERROR_CODES: readonly BudgetErrorCode[] = [BudgetErrorCode.CurrencyUnsupported];

/**
 * Fallo de negocio del flujo de presupuestos, que ya trae el texto a mostrar.
 * `code` es null cuando el backend envió algo que este dominio no conoce.
 */
export class BudgetError extends Error {
  constructor(
    message: string,
    readonly code: BudgetErrorCode | null = null,
  ) {
    super(message);
    this.name = 'BudgetError';
  }
}
