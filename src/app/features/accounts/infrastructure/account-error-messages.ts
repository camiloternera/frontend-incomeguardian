import { ACCOUNT_NAME_MAX_LENGTH } from '../domain/account';
import { AccountErrorCode } from '../domain/account-error';

/** Cada código conocido del backend para cuentas, asociado a su clave de traducción. */
export const ACCOUNT_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(AccountErrorCode).map((code) => [code, `accounts.errors.${code}`]),
);

/** Valores que interpolan los mensajes de longitud, para que el texto no fije los límites a mano. */
export const ACCOUNT_ERROR_PARAMS = { nameMax: ACCOUNT_NAME_MAX_LENGTH };
