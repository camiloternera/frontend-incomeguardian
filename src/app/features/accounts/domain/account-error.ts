/**
 * Códigos de negocio que envía el backend para cuentas, escritos tal cual los envía.
 * Comparar contra estas constantes en lugar de escribir los textos a mano.
 */
export const AccountErrorCode = {
  NameRequired: 'ACCOUNT_NAME_REQUIRED',
  NameMaxLength: 'ACCOUNT_NAME_MAX_LENGTH',
  /** Cambiar el nombre de una cuenta que ya tiene movimientos. */
  NameLocked: 'ACCOUNT_NAME_LOCKED',
  NotFound: 'ACCOUNT_NOT_FOUND',
  CurrencyRequired: 'ACCOUNT_CURRENCY_REQUIRED',
  CurrencyInvalid: 'ACCOUNT_CURRENCY_INVALID',
  CurrencyLocked: 'ACCOUNT_CURRENCY_LOCKED',
  OpeningDateRequired: 'ACCOUNT_OPENING_DATE_REQUIRED',
  OpeningDateFuture: 'ACCOUNT_OPENING_DATE_FUTURE',
  /** Cambiar saldo inicial o moneda cuando ya hay meses cerrados desde la apertura. */
  LockedByClosedPeriod: 'ACCOUNT_LOCKED_BY_CLOSED_PERIOD',
  KindInvalid: 'ACCOUNT_KIND_INVALID',
  /** Cambiar el tipo de una cuenta que ya tiene movimientos. */
  KindLocked: 'ACCOUNT_KIND_LOCKED',
  StatementDayRequired: 'ACCOUNT_STATEMENT_DAY_REQUIRED',
  StatementDayInvalid: 'ACCOUNT_STATEMENT_DAY_INVALID',
  PaymentDayRequired: 'ACCOUNT_PAYMENT_DAY_REQUIRED',
  PaymentDayInvalid: 'ACCOUNT_PAYMENT_DAY_INVALID',
  CreditLimitInvalid: 'ACCOUNT_CREDIT_LIMIT_INVALID',
  /** Una tarjeta con deuda inicial positiva: la deuda va en negativo. */
  CardInitialBalancePositive: 'CREDIT_CARD_INITIAL_BALANCE_POSITIVE',
  /** Pedir el extracto de una cuenta que no es tarjeta. */
  NotCreditCard: 'ACCOUNT_NOT_CREDIT_CARD',
} as const;

export type AccountErrorCode = (typeof AccountErrorCode)[keyof typeof AccountErrorCode];

const KNOWN_CODES: readonly string[] = Object.values(AccountErrorCode);

/** Indica si el código recibido es uno de los que conoce este dominio. */
export function isAccountErrorCode(code: string | undefined): code is AccountErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

/** Códigos que pertenecen a un campo del formulario, para mostrarlos junto a él. */
export const NAME_ERROR_CODES: readonly AccountErrorCode[] = [
  AccountErrorCode.NameRequired,
  AccountErrorCode.NameMaxLength,
  AccountErrorCode.NameLocked,
];

export const CURRENCY_ERROR_CODES: readonly AccountErrorCode[] = [
  AccountErrorCode.CurrencyRequired,
  AccountErrorCode.CurrencyInvalid,
  AccountErrorCode.CurrencyLocked,
];

export const KIND_ERROR_CODES: readonly AccountErrorCode[] = [
  AccountErrorCode.KindInvalid,
  AccountErrorCode.KindLocked,
];

export const CREDIT_LIMIT_ERROR_CODES: readonly AccountErrorCode[] = [AccountErrorCode.CreditLimitInvalid];

export const STATEMENT_DAY_ERROR_CODES: readonly AccountErrorCode[] = [
  AccountErrorCode.StatementDayRequired,
  AccountErrorCode.StatementDayInvalid,
];

export const PAYMENT_DAY_ERROR_CODES: readonly AccountErrorCode[] = [
  AccountErrorCode.PaymentDayRequired,
  AccountErrorCode.PaymentDayInvalid,
];

export const OPENING_DATE_ERROR_CODES: readonly AccountErrorCode[] = [
  AccountErrorCode.OpeningDateRequired,
  AccountErrorCode.OpeningDateFuture,
];

/**
 * Fallo de negocio del flujo de cuentas, que ya trae el texto a mostrar.
 * `code` es null cuando el backend envió algo que este dominio no conoce.
 */
export class AccountError extends Error {
  constructor(
    message: string,
    readonly code: AccountErrorCode | null = null,
  ) {
    super(message);
    this.name = 'AccountError';
  }
}
