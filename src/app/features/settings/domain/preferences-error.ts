/**
 * Códigos de negocio que envía el backend para las preferencias, escritos tal cual los envía.
 * Comparar contra estas constantes en lugar de escribir los textos a mano.
 */
export const PreferencesErrorCode = {
  ThemeInvalid: 'USER_THEME_INVALID',
  LanguageInvalid: 'USER_LANGUAGE_INVALID',
} as const;

export type PreferencesErrorCode = (typeof PreferencesErrorCode)[keyof typeof PreferencesErrorCode];

const KNOWN_CODES: readonly string[] = Object.values(PreferencesErrorCode);

/** Indica si el código recibido es uno de los que conoce este dominio. */
export function isPreferencesErrorCode(code: string | undefined): code is PreferencesErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

/**
 * Fallo al leer o guardar las preferencias, que ya trae el texto a mostrar.
 * `code` es null cuando el backend envió algo que este dominio no conoce.
 */
export class PreferencesError extends Error {
  constructor(
    message: string,
    readonly code: PreferencesErrorCode | null = null,
  ) {
    super(message);
    this.name = 'PreferencesError';
  }
}
