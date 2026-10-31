/** Temas de la app. TypeScript puro para que los dominios puedan usarlo sin importar Angular. */
export const THEMES = ['forest', 'paper', 'noir'] as const;

export type ThemeName = (typeof THEMES)[number];

/** Indica si un valor recibido (almacenamiento, API) es un tema válido. */
export function isThemeName(value: unknown): value is ThemeName {
  return THEMES.includes(value as ThemeName);
}
