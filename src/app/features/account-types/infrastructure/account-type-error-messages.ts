import { ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH, ACCOUNT_TYPE_NAME_MAX_LENGTH } from '../domain/account-type';
import { AccountTypeErrorCode } from '../domain/account-type-error';

/** Cada código conocido del backend para tipos de cuenta, asociado a su clave de traducción. */
export const ACCOUNT_TYPE_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(AccountTypeErrorCode).map((code) => [code, `accountTypes.errors.${code}`]),
);

/** Valores que interpolan los mensajes de longitud, para que el texto no fije los límites a mano. */
export const ACCOUNT_TYPE_ERROR_PARAMS = {
  nameMax: ACCOUNT_TYPE_NAME_MAX_LENGTH,
  descriptionMax: ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH,
};
