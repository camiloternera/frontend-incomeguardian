/**
 * Culturas que declara la API; cualquier otra cae en la de por defecto.
 * TypeScript puro para que los dominios puedan usarlo sin importar Angular.
 */
export const LANGUAGES = ['es-CO', 'en-US'] as const;

export type Language = (typeof LANGUAGES)[number];

/** Indica si un valor recibido (almacenamiento, API) es un idioma soportado. */
export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}
