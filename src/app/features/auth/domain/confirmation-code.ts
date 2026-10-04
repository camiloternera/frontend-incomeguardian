export const CONFIRMATION_CODE_LENGTH = 6;

/** Drops everything that is not a digit and trims the result to `max` characters. */
export function onlyDigits(raw: string, max = CONFIRMATION_CODE_LENGTH): string {
  return raw.replace(/\D/g, '').slice(0, max);
}

export function isConfirmationCodeComplete(code: string): boolean {
  return code.length === CONFIRMATION_CODE_LENGTH && onlyDigits(code) === code;
}
