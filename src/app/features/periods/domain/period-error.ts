/**
 * Códigos de negocio que envía el backend para el cierre de períodos, escritos tal cual los envía.
 * Comparar contra estas constantes en lugar de escribir los textos a mano.
 */
export const PeriodErrorCode = {
  Invalid: 'PERIOD_INVALID',
  AlreadyClosed: 'PERIOD_ALREADY_CLOSED',
  NotEnded: 'PERIOD_NOT_ENDED',
  NoActivity: 'PERIOD_NO_ACTIVITY',
  PreviousOpen: 'PERIOD_PREVIOUS_OPEN',
  NotClosed: 'PERIOD_NOT_CLOSED',
  RecloseModeInvalid: 'PERIOD_RECLOSE_MODE_INVALID',
  ReasonMaxLength: 'PERIOD_REASON_MAX_LENGTH',
  CloseDayInvalid: 'PERIOD_CLOSE_DAY_INVALID',
  /** Un movimiento con fecha en un mes cerrado. */
  Closed: 'PERIOD_CLOSED',
} as const;

export type PeriodErrorCode = (typeof PeriodErrorCode)[keyof typeof PeriodErrorCode];

const KNOWN_CODES: readonly string[] = Object.values(PeriodErrorCode);

/** Indica si el código recibido es uno de los que conoce este dominio. */
export function isPeriodErrorCode(code: string | undefined): code is PeriodErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

/**
 * Fallo de negocio del cierre de períodos, que ya trae el texto a mostrar.
 * `code` es null cuando el backend envió algo que este dominio no conoce.
 */
export class PeriodError extends Error {
  constructor(
    message: string,
    readonly code: PeriodErrorCode | null = null,
  ) {
    super(message);
    this.name = 'PeriodError';
  }
}
