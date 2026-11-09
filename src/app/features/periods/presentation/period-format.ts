import { formatDate } from '@angular/common';
/** Desfase de Colombia, para mostrar los instantes del backend en su hora. */
const PERIOD_OFFSET = '-0500';

/** Nombre del mes en el idioma activo: «octubre» / «October», o abreviado («oct.» / «Oct»). */
export function monthName(month: number, locale: string, short = false): string {
  const date = new Date(Date.UTC(2000, month - 1, 15));

  return new Intl.DateTimeFormat(locale, { month: short ? 'short' : 'long', timeZone: 'UTC' }).format(date);
}

/** Solo la primera letra en mayúscula. */
export function capitalized(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** Abreviatura de la grilla de meses: «Ene» / «Jan», sin el punto del español. */
export function monthShort(month: number, locale: string): string {
  return capitalized(monthName(month, locale, true).replace('.', ''), locale);
}

/**
 * Patrón de fecha con el mes en letras. El `mediumDate` de es-CO es numérico (9/11/2026) y se
 * confunde con el formato de EE. UU., así que se fija uno explícito.
 */
function dayPattern(locale: string): string {
  return locale.startsWith('es') ? 'd MMM y' : 'MMM d, y';
}

/** Fecha de un día (`yyyy-MM-dd`): «5 nov 2026» / «Nov 5, 2026». */
export function formatDay(date: string, locale: string): string {
  return formatDate(`${date}T00:00:00`, dayPattern(locale), locale).replace('.', '');
}

/** Un instante del backend como fecha en hora de Colombia. */
export function formatInstant(instant: string, locale: string): string {
  return formatDate(instant, dayPattern(locale), locale, PERIOD_OFFSET).replace('.', '');
}

/** Día y mes corto de un día (`yyyy-MM-dd`): «8 nov» / «Nov 8». */
export function formatDayMonth(date: string, locale: string): string {
  const pattern = locale.startsWith('es') ? 'd MMM' : 'MMM d';

  return formatDate(`${date}T00:00:00`, pattern, locale).replace('.', '');
}

/** Monto en su moneda, sin decimales para COP y con dos para USD. */
export function formatAmount(value: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(value);
}

/** Porcentaje que llega del backend de 0 a 100. */
export function formatRate(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
}
