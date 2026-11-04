/**
 * Aritmética de fechas de calendario en el formato `YYYY-MM-DD`, sin hora ni zona horaria.
 * Todo se calcula en UTC para que un cambio de horario nunca mueva el día.
 */

/** Fecha de calendario `YYYY-MM-DD`, el mismo formato del `<input type="date">`. */
export type CalendarDate = string;

/** Días de una cuadrícula de mes: seis semanas completas, para que el alto no salte entre meses. */
export const MONTH_GRID_DAYS = 42;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Convierte `YYYY-MM-DD` en un `Date` a medianoche UTC; `null` si el texto no es una fecha real. */
export function parseCalendarDate(value: string | null | undefined): Date | null {
  const match = value ? ISO_DATE.exec(value) : null;

  if (!match) {
    return null;
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));

  // `Date.UTC` desborda (31 de febrero → 3 de marzo); esa fecha no existe.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

/** Formatea un `Date` (leído en UTC) como `YYYY-MM-DD`. */
export function toCalendarDate(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

/** La fecha `days` días antes (negativo) o después (positivo). */
export function addDays(value: CalendarDate, days: number): CalendarDate {
  const date = parseCalendarDate(value)!;
  date.setUTCDate(date.getUTCDate() + days);

  return toCalendarDate(date);
}

/** Primer día del mes `months` meses antes o después del de `value`. */
export function addMonths(value: CalendarDate, months: number): CalendarDate {
  const date = parseCalendarDate(value)!;

  return toCalendarDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)));
}

/** Primer día del mes de `value`. */
export function startOfMonth(value: CalendarDate): CalendarDate {
  return `${value.slice(0, 7)}-01`;
}

/** Primer día del mes `month` (0–11) del año `year`. */
export function monthStart(year: number, month: number): CalendarDate {
  return toCalendarDate(new Date(Date.UTC(year, month, 1)));
}

/**
 * Las 42 fechas de la cuadrícula del mes de `value`, empezando en domingo como en es-CO y en-US.
 * Incluye los días finales del mes anterior y los iniciales del siguiente.
 */
export function monthGrid(value: CalendarDate): CalendarDate[] {
  const first = parseCalendarDate(startOfMonth(value))!;
  const start = addDays(toCalendarDate(first), -first.getUTCDay());

  return Array.from({ length: MONTH_GRID_DAYS }, (_, index) => addDays(start, index));
}

/** Domingo de la semana de `value`. */
export function startOfWeek(value: CalendarDate): CalendarDate {
  return addDays(value, -parseCalendarDate(value)!.getUTCDay());
}

/** Año de `value`. */
export function yearOf(value: CalendarDate): number {
  return Number(value.slice(0, 4));
}

/** Mes (0–11) de `value`. */
export function monthOf(value: CalendarDate): number {
  return Number(value.slice(5, 7)) - 1;
}

/** Acota `value` al rango `[min, max]`; cualquiera de los dos puede faltar. */
export function clampDate(
  value: CalendarDate,
  min: CalendarDate | null,
  max: CalendarDate | null,
): CalendarDate {
  if (min && value < min) {
    return min;
  }

  return max && value > max ? max : value;
}

/** Formatea `value` en `locale` con las opciones de `Intl`, siempre leído en UTC. */
export function formatCalendarDate(
  value: CalendarDate,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    parseCalendarDate(value)!,
  );
}
