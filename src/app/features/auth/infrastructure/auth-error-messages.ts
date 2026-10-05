/** Known backend codes for the auth flow, mapped to their translation keys. */
export const AUTH_ERROR_KEYS: Record<string, string> = {
  USER_INVALID_CREDENTIALS: 'auth.errors.USER_INVALID_CREDENTIALS',
  USER_ALREADY_EXISTS: 'auth.errors.USER_ALREADY_EXISTS',
  USER_EMAIL_ALREADY_EXISTS: 'auth.errors.USER_EMAIL_ALREADY_EXISTS',
  USER_EMAIL_NOT_CONFIRMED: 'auth.errors.USER_EMAIL_NOT_CONFIRMED',
  VERIFICATION_CODE_EXPIRED: 'auth.errors.VERIFICATION_CODE_EXPIRED',
};
