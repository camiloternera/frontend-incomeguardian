/**
 * Plazos del código de verificación que el backend acaba de enviar al correo.
 * Las fechas llegan en ISO UTC, igual que `AuthSession.expiresAt`.
 */
export interface VerificationWindow {
  email: string;
  /** Momento en que el código deja de servir. */
  expiresAt: string;
  /** Momento a partir del cual se puede pedir otro código. */
  resendAvailableAt: string;
}

/** Datos para pedir un código nuevo para un registro pendiente. */
export interface CodeResendRequest {
  email: string;
  /** Zona horaria IANA con la que el correo muestra la hora de vencimiento. */
  timeZone?: string;
}

/** Fecha ISO válida o `null`, para leer plazos que pueden venir incompletos o mal formados. */
export function parseInstant(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const instant = new Date(value);

  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Segundos enteros que faltan hasta `target`; cero si ya pasó o no hay fecha. */
export function secondsUntil(target: Date | null, now: number): number {
  return target ? Math.max(0, Math.ceil((target.getTime() - now) / 1000)) : 0;
}
