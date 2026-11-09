import { PERIOD_REASON_MAX_LENGTH } from '../domain/period';
import { PeriodErrorCode } from '../domain/period-error';

/** Cada código conocido del backend para períodos, asociado a su clave de traducción. */
export const PERIOD_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(PeriodErrorCode).map((code) => [code, `periods.errors.${code}`]),
);

/** Valores que interpolan los mensajes, para que el texto no fije los límites a mano. */
export const PERIOD_ERROR_PARAMS = { reasonMax: PERIOD_REASON_MAX_LENGTH };
