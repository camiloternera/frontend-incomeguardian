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
  TransactionErrorCode.CategoryNotFound,
  TransactionErrorCode.CategoryTypeMismatch,
];

export const DESCRIPTION_ERROR_CODES: readonly TransactionErrorCode[] = [TransactionErrorCode.DescriptionMaxLength];

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
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}
