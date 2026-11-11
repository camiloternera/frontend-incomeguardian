/**
 * Patrones de fecha con el mes en letras para el `DatePipe`. El `mediumDate` de es-CO es numérico
 * (25/11/2026) y en inglés el mes va antes del día, así que cada idioma tiene su propio patrón.
 */

function isSpanish(locale: string): boolean {
  return locale.startsWith('es');
}

/** Día y mes corto: «25 nov» / «Nov 25». */
export function shortDayPattern(locale: string): string {
  return isSpanish(locale) ? 'd MMM' : 'MMM d';
}

/** Día, mes corto y año: «25 nov 2026» / «Nov 25, 2026». */
export function dayPattern(locale: string): string {
  return isSpanish(locale) ? 'd MMM y' : 'MMM d, y';
}

/** Día y mes completo, para usar dentro de una frase: «10 de enero» / «January 10». */
export function longDayPattern(locale: string): string {
  return isSpanish(locale) ? "d 'de' MMMM" : 'MMMM d';
}
