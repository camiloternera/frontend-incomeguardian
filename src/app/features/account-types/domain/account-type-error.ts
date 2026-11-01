/**
 * Códigos de negocio que envía el backend para tipos de cuenta, escritos tal cual los envía.
 * Comparar contra estas constantes en lugar de escribir los textos a mano.
 */
export const AccountTypeErrorCode = {
  NameRequired: 'ACCOUNT_TYPE_NAME_REQUIRED',
  NameMaxLength: 'ACCOUNT_TYPE_NAME_MAX_LENGTH',
  NameAlreadyExists: 'ACCOUNT_TYPE_NAME_ALREADY_EXISTS',
  DescriptionRequired: 'ACCOUNT_TYPE_DESCRIPTION_REQUIRED',
  DescriptionMaxLength: 'ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH',
  NotFound: 'ACCOUNT_TYPE_NOT_FOUND',
} as const;

export type AccountTypeErrorCode = (typeof AccountTypeErrorCode)[keyof typeof AccountTypeErrorCode];

const KNOWN_CODES: readonly string[] = Object.values(AccountTypeErrorCode);

/** Indica si el código recibido es uno de los que conoce este dominio. */
export function isAccountTypeErrorCode(code: string | undefined): code is AccountTypeErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

/** Códigos que pertenecen a un campo del formulario, para mostrarlos junto a él. */
export const NAME_ERROR_CODES: readonly AccountTypeErrorCode[] = [
  AccountTypeErrorCode.NameRequired,
  AccountTypeErrorCode.NameMaxLength,
  AccountTypeErrorCode.NameAlreadyExists,
];

export const DESCRIPTION_ERROR_CODES: readonly AccountTypeErrorCode[] = [
  AccountTypeErrorCode.DescriptionRequired,
  AccountTypeErrorCode.DescriptionMaxLength,
];

/**
 * Fallo de negocio del flujo de tipos de cuenta, que ya trae el texto a mostrar.
 * `code` es null cuando el backend envió algo que este dominio no conoce.
 */
export class AccountTypeError extends Error {
  constructor(
    message: string,
    readonly code: AccountTypeErrorCode | null = null,
  ) {
    super(message);
    this.name = 'AccountTypeError';
  }
}
