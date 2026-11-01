/**
 * Códigos de negocio que envía el backend para cuentas, escritos tal cual los envía.
 * Comparar contra estas constantes en lugar de escribir los textos a mano.
 */
export const AccountErrorCode = {
  NameRequired: 'ACCOUNT_NAME_REQUIRED',
  NameMaxLength: 'ACCOUNT_NAME_MAX_LENGTH',
  NotFound: 'ACCOUNT_NOT_FOUND',
  TypeInvalid: 'ACCOUNT_TYPE_INVALID',
  CurrencyRequired: 'ACCOUNT_CURRENCY_REQUIRED',
  CurrencyInvalid: 'ACCOUNT_CURRENCY_INVALID',
  CurrencyLocked: 'ACCOUNT_CURRENCY_LOCKED',
} as const;

export type AccountErrorCode = (typeof AccountErrorCode)[keyof typeof AccountErrorCode];

const KNOWN_CODES: readonly string[] = Object.values(AccountErrorCode);

/** Indica si el código recibido es uno de los que conoce este dominio. */
export function isAccountErrorCode(code: string | undefined): code is AccountErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

/** Códigos que pertenecen a un campo del formulario, para mostrarlos junto a él. */
export const NAME_ERROR_CODES: readonly AccountErrorCode[] = [AccountErrorCode.NameRequired, AccountErrorCode.NameMaxLength];

export const TYPE_ERROR_CODES: readonly AccountErrorCode[] = [AccountErrorCode.TypeInvalid];

export const CURRENCY_ERROR_CODES: readonly AccountErrorCode[] = [
  AccountErrorCode.CurrencyRequired,
  AccountErrorCode.CurrencyInvalid,
  AccountErrorCode.CurrencyLocked,
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
