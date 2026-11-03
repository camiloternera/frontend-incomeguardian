import { TRANSACTION_DESCRIPTION_MAX_LENGTH } from '../domain/transaction';
import { TransactionErrorCode } from '../domain/transaction-error';

/** Cada código conocido del backend para movimientos, asociado a su clave de traducción. */
export const TRANSACTION_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(TransactionErrorCode).map((code) => [code, `transactions.errors.${code}`]),
);

/** Valores que interpolan los mensajes de longitud, para que el texto no fije los límites a mano. */
export const TRANSACTION_ERROR_PARAMS = { descriptionMax: TRANSACTION_DESCRIPTION_MAX_LENGTH };
