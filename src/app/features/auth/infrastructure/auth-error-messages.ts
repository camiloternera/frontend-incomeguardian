import { AuthErrorReason } from '../domain/auth-error';

/** Known backend codes for the auth flow, mapped to their translation keys. */
export const AUTH_ERROR_KEYS: Record<string, string> = {
  USER_INVALID_CREDENTIALS: 'auth.errors.USER_INVALID_CREDENTIALS',
  USER_ALREADY_EXISTS: 'auth.errors.USER_ALREADY_EXISTS',
  USER_EMAIL_ALREADY_EXISTS: 'auth.errors.USER_EMAIL_ALREADY_EXISTS',
  USER_EMAIL_ALREADY_REGISTERED: 'auth.errors.USER_EMAIL_ALREADY_REGISTERED',
  USER_EMAIL_NOT_CONFIRMED: 'auth.errors.USER_EMAIL_NOT_CONFIRMED',
  VERIFICATION_CODE_EXPIRED: 'auth.errors.VERIFICATION_CODE_EXPIRED',
  VERIFICATION_CODE_INVALID: 'auth.errors.VERIFICATION_CODE_INVALID',
  VERIFICATION_CODE_ATTEMPTS_EXCEEDED: 'auth.errors.VERIFICATION_CODE_ATTEMPTS_EXCEEDED',
  VERIFICATION_RESEND_TOO_SOON: 'auth.errors.VERIFICATION_RESEND_TOO_SOON',
  VERIFICATION_REGISTRATION_NOT_FOUND: 'auth.errors.VERIFICATION_REGISTRATION_NOT_FOUND',
};

/** Copy de `VERIFICATION_CODE_INVALID` cuando el backend informa los intentos que quedan. */
export const REMAINING_ATTEMPTS_KEY = 'auth.errors.VERIFICATION_CODE_INVALID_REMAINING';

/** Códigos del backend que la vista de confirmación trata de forma distinta al resto. */
export const AUTH_ERROR_REASONS: Record<string, AuthErrorReason> = {
  VERIFICATION_CODE_EXPIRED: 'codeExpired',
  VERIFICATION_CODE_INVALID: 'codeInvalid',
  VERIFICATION_CODE_ATTEMPTS_EXCEEDED: 'attemptsExceeded',
  VERIFICATION_RESEND_TOO_SOON: 'resendTooSoon',
  VERIFICATION_REGISTRATION_NOT_FOUND: 'registrationNotFound',
  USER_EMAIL_ALREADY_REGISTERED: 'alreadyRegistered',
};
