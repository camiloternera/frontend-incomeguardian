import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CalendarDate, toCalendarDate } from '@shared/ui/date-picker/calendar-date';

/** Fecha y hora de apertura tal como las editan los campos: `YYYY-MM-DD` y `HH:mm`, en hora local. */
export interface OpeningDateParts {
  day: CalendarDate;
  time: string;
}

/** Completa con ceros a la izquierda hasta dos cifras. */
function pad(value: number): string {
  return String(Math.trunc(value)).padStart(2, '0');
}

/** Separa un instante en el día y la hora (sin segundos) del navegador, para llenar los campos. */
export function toOpeningParts(date: Date): OpeningDateParts {
  return {
    day: toCalendarDate(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/** El instante local que forman el día y la hora, o `null` si alguno no es válido. */
export function openingInstant(day: string, time: string): Date | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);

  if (!dayMatch || !timeMatch) {
    return null;
  }

  const [, year, month, date] = dayMatch.map(Number);
  const [, hours, minutes] = timeMatch.map(Number);
  const instant = new Date(year, month - 1, date, hours, minutes);

  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * ISO 8601 con el desfase del navegador (por ejemplo `2026-01-15T09:30:00-05:00`), para que el
 * backend reciba la hora que el usuario ve en pantalla.
 */
export function toOffsetIso(instant: Date): string {
  const offset = -instant.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  const { day, time } = toOpeningParts(instant);

  return `${day}T${time}:00${sign}${pad(absolute / 60)}:${pad(absolute % 60)}`;
}

/**
 * Validador del grupo: la apertura no puede ser posterior al instante actual. Lee los controles
 * `openingDay` y `openingTime`; si falta alguno, deja el error a su validador `required`.
 */
export const openingNotInFuture: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const day = group.get('openingDay')?.value as string | undefined;
  const time = group.get('openingTime')?.value as string | undefined;
  const instant = day && time ? openingInstant(day, time) : null;

  return instant && instant.getTime() > Date.now() ? { openingFuture: true } : null;
};
