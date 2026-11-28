/**
 * Motivo de negocio de un fallo del flujo de verificación, para que la vista decida qué
 * hacer (bloquear el código, reiniciar la espera, ir al login) sin leer códigos del backend.
 */
export type AuthErrorReason =
  | 'codeExpired'
  | 'codeInvalid'
  | 'attemptsExceeded'
  | 'resendTooSoon'
  | 'registrationNotFound'
  | 'alreadyRegistered';

export interface AuthErrorDetails {
  reason?: AuthErrorReason;
  /** ISO UTC desde el que se puede reenviar, cuando el reenvío llegó antes de tiempo. */
  resendAvailableAt?: string;
}

/** A business failure from the auth flow, already carrying the copy to show. */
export class AuthError extends Error {
  readonly reason?: AuthErrorReason;
  readonly resendAvailableAt?: string;

  constructor(message: string, details: AuthErrorDetails = {}) {
    super(message);
    this.name = 'AuthError';
    this.reason = details.reason;
    this.resendAvailableAt = details.resendAvailableAt;
  }
}
