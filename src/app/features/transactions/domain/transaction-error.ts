import { TransactionMonth } from './transaction';

/**
 * Códigos de negocio que envía el backend para movimientos, escritos tal cual los envía.
 * Comparar contra estas constantes en lugar de escribir los textos a mano.
 */
export const TransactionErrorCode = {
  AmountInvalid: 'TRANSACTION_AMOUNT_INVALID',
  TypeInvalid: 'TRANSACTION_TYPE_INVALID',
  AccountRequired: 'TRANSACTION_ACCOUNT_REQUIRED',
  AccountsMustDiffer: 'TRANSACTION_ACCOUNTS_MUST_DIFFER',
  AccountNotFound: 'TRANSACTION_ACCOUNT_NOT_FOUND',
  AccountInactive: 'ACCOUNT_INACTIVE',
  /** Falta la categoría del movimiento. */
  CategoryRequired: 'TRANSACTION_CATEGORY_REQUIRED',
  CategoryNotFound: 'TRANSACTION_CATEGORY_NOT_FOUND',
  CategoryTypeMismatch: 'TRANSACTION_CATEGORY_TYPE_MISMATCH',
  DescriptionMaxLength: 'TRANSACTION_DESCRIPTION_MAX_LENGTH',
  PageInvalid: 'TRANSACTION_PAGE_INVALID',
  DateRangeInvalid: 'TRANSACTION_DATE_RANGE_INVALID',
  NotFound: 'TRANSACTION_NOT_FOUND',
  /** Alguna de las cuentas está en una moneda que ya no se admite (EUR). */
  AccountCurrencyUnsupported: 'TRANSACTION_ACCOUNT_CURRENCY_UNSUPPORTED',
  ExchangeRateUnavailable: 'EXCHANGE_RATE_UNAVAILABLE',
  ExchangeRateDateInvalid: 'EXCHANGE_RATE_DATE_INVALID',
  /** La fecha cae en un mes cerrado; el formulario muestra la nota de fecha cerrada. */
  PeriodClosed: 'PERIOD_CLOSED',
  /** Cuotas en un gasto que no es con tarjeta. */
  InstallmentsNotAllowed: 'TRANSACTION_INSTALLMENTS_NOT_ALLOWED',
  InstallmentsOutOfRange: 'TRANSACTION_INSTALLMENTS_OUT_OF_RANGE',
  InterestRateOutOfRange: 'TRANSACTION_INTEREST_RATE_OUT_OF_RANGE',
  /** Comisión en una transferencia que no es avance (por ejemplo, de tarjeta a tarjeta). */
  AdvanceFeeNotAllowed: 'TRANSACTION_ADVANCE_FEE_NOT_ALLOWED',
  /** Comisión de un avance en cero o negativa. */
  AdvanceFeeInvalid: 'TRANSACTION_ADVANCE_FEE_INVALID',
  /** La comisión de un avance se edita o elimina desde su avance. */
  ManagedByParent: 'TRANSACTION_MANAGED_BY_PARENT',
} as const;

export type TransactionErrorCode = (typeof TransactionErrorCode)[keyof typeof TransactionErrorCode];

const KNOWN_CODES: readonly string[] = Object.values(TransactionErrorCode);

/** Indica si el código recibido es uno de los que conoce este dominio. */
export function isTransactionErrorCode(code: string | undefined): code is TransactionErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

/** Códigos que pertenecen a un campo del formulario, para mostrarlos junto a él. */
export const AMOUNT_ERROR_CODES: readonly TransactionErrorCode[] = [TransactionErrorCode.AmountInvalid];

export const ACCOUNT_ERROR_CODES: readonly TransactionErrorCode[] = [
  TransactionErrorCode.AccountRequired,
  TransactionErrorCode.AccountsMustDiffer,
  TransactionErrorCode.AccountNotFound,
  TransactionErrorCode.AccountInactive,
  TransactionErrorCode.AccountCurrencyUnsupported,
];

export const CATEGORY_ERROR_CODES: readonly TransactionErrorCode[] = [
  TransactionErrorCode.CategoryRequired,
  TransactionErrorCode.CategoryNotFound,
  TransactionErrorCode.CategoryTypeMismatch,
];

export const DESCRIPTION_ERROR_CODES: readonly TransactionErrorCode[] = [TransactionErrorCode.DescriptionMaxLength];

export const INSTALLMENT_ERROR_CODES: readonly TransactionErrorCode[] = [
  TransactionErrorCode.InstallmentsNotAllowed,
  TransactionErrorCode.InstallmentsOutOfRange,
  TransactionErrorCode.InterestRateOutOfRange,
];

export const ADVANCE_FEE_ERROR_CODES: readonly TransactionErrorCode[] = [
  TransactionErrorCode.AdvanceFeeNotAllowed,
  TransactionErrorCode.AdvanceFeeInvalid,
];

/** Fallos de la TRM: la transferencia entre monedas no se puede calcular ni crear. */
export const RATE_ERROR_CODES: readonly TransactionErrorCode[] = [
  TransactionErrorCode.ExchangeRateUnavailable,
  TransactionErrorCode.ExchangeRateDateInvalid,
];

/**
 * Fallo de negocio del flujo de movimientos, que ya trae el texto a mostrar.
 * `code` es null cuando el backend envió algo que este dominio no conoce.
 */
export class TransactionError extends Error {
  constructor(
    message: string,
    readonly code: TransactionErrorCode | null = null,
    /** Con `PERIOD_CLOSED`, el primer mes cerrado que bloquea (puede ser el de una cuota). */
    readonly closedMonth: TransactionMonth | null = null,
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}
