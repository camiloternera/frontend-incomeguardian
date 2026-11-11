/**
 * Calendario de una tarjeta de crédito: cuándo corta y hasta cuándo se paga. Replica las reglas del
 * backend (`CreditCardCalendar`); todas las fechas son días `YYYY-MM-DD` en hora de Colombia.
 *
 * - Si el día de corte o de pago no existe en el mes, se usa el último día del mes.
 * - Una compra hecha hasta el día de corte (incluido) cae en el extracto de ese mes; si es después,
 *   en el del mes siguiente.
 * - Si el día de pago es posterior al de corte, se paga en el mismo mes del corte; si no, en el siguiente.
 */

/** Zona horaria en la que el backend decide los cortes. */
export const CARD_TIME_ZONE = 'America/Bogota';

/** El día `YYYY-MM-DD` de ese instante en hora de Colombia. */
export function cardDayOf(instant: Date): string {
  // `en-CA` formatea las fechas como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', { timeZone: CARD_TIME_ZONE }).format(instant);
}

/** Un mes del calendario; `month` va de 1 a 12. */
export interface CardMonth {
  year: number;
  month: number;
}

/** Días que tiene el mes. */
function daysInMonth({ year, month }: CardMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Mes desplazado `delta` meses (negativo hacia atrás). */
export function shiftCardMonth({ year, month }: CardMonth, delta: number): CardMonth {
  const index = year * 12 + (month - 1) + delta;

  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Compara dos meses: negativo si `a` es anterior, 0 si son el mismo. */
export function compareCardMonths(a: CardMonth, b: CardMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** El día `day` del mes como `YYYY-MM-DD`, ajustado al último día si el mes es más corto. */
function dayInMonth(month: CardMonth, day: number): string {
  const clamped = Math.min(day, daysInMonth(month));

  return `${month.year}-${pad(month.month)}-${pad(clamped)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDay(day: string): { month: CardMonth; date: number } {
  const [year, month, date] = day.split('-').map(Number);

  return { month: { year, month }, date };
}

/** Fecha de corte del extracto de ese mes. */
export function statementDate(month: CardMonth, statementDay: number): string {
  return dayInMonth(month, statementDay);
}

/** Mes del extracto en el que cae una compra hecha ese día. */
export function statementMonthFor(day: string, statementDay: number): CardMonth {
  const { month, date } = parseDay(day);
  const cut = Math.min(statementDay, daysInMonth(month));

  return date <= cut ? month : shiftCardMonth(month, 1);
}

/** Fecha límite para pagar el extracto que corta en ese mes. */
export function paymentDueDate(statementMonth: CardMonth, statementDay: number, paymentDay: number): string {
  const dueMonth = paymentDay > statementDay ? statementMonth : shiftCardMonth(statementMonth, 1);

  return dayInMonth(dueMonth, paymentDay);
}

/**
 * Próxima fecha de corte; si hoy es el día de corte, es hoy.
 *
 * La próxima fecha límite de pago de una cuenta no se calcula aquí: depende de la apertura y de qué
 * extractos quedan con saldo (pagos FIFO), así que siempre se usa `nextPaymentDueDate` de la API.
 */
export function nextStatementDate(today: string, statementDay: number): string {
  return statementDate(statementMonthFor(today, statementDay), statementDay);
}
