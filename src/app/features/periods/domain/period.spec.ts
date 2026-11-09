import {
  PeriodMonthStatus,
  PeriodYear,
  daysBetween,
  defaultMonthOf,
  isClosedDate,
  lastDayOf,
  openMonths,
  todayInPeriodZone,
  yearMonthOf,
} from './period';
import { PeriodError, PeriodErrorCode, isPeriodErrorCode } from './period-error';

/** Año con un estado por mes; los que falten quedan como `future`. */
function periodYear(year: number, statuses: readonly PeriodMonthStatus[]): PeriodYear {
  return {
    year,
    yearClosed: false,
    yearClosedAt: null,
    yearClosedAutomatically: false,
    canCloseYear: false,
    canReopenYear: false,
    firstActivity: `${year}-01`,
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      status: statuses[index] ?? 'future',
      closedAt: null,
      closedAutomatically: false,
      reopenedAt: null,
      recloseMode: null,
      recloseAt: null,
      autoCloseOn: null,
      canClose: false,
      canReopen: false,
    })),
  };
}

describe('period rules', () => {
  it('takes today in Colombia, not in the browser zone', () => {
    // 03:00 UTC del 1 de noviembre todavía es 31 de octubre en Bogotá (UTC-5).
    expect(todayInPeriodZone(new Date('2026-11-01T03:00:00Z'))).toBe('2026-10-31');
    expect(todayInPeriodZone(new Date('2026-11-01T05:00:00Z'))).toBe('2026-11-01');
  });

  it('reads the year and month of a date and rejects other formats', () => {
    expect(yearMonthOf('2026-03-15')).toEqual({ year: 2026, month: 3 });
    expect(yearMonthOf('2026-03')).toEqual({ year: 2026, month: 3 });
    expect(yearMonthOf('15/03/2026')).toBeNull();
    expect(yearMonthOf('')).toBeNull();
  });

  it('counts whole days between two dates, across months and years', () => {
    expect(daysBetween('2026-10-31', '2026-11-08')).toBe(8);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-08', '2026-11-08')).toBe(0);
  });

  it('knows the last day of every month, leap years included', () => {
    expect(lastDayOf(2026, 2)).toBe('2026-02-28');
    expect(lastDayOf(2028, 2)).toBe('2028-02-29');
    expect(lastDayOf(2026, 9)).toBe('2026-09-30');
    expect(lastDayOf(2026, 12)).toBe('2026-12-31');
  });

  it('lists only the months that still need closing', () => {
    const year = periodYear(2026, ['noActivity', 'closed', 'pending', 'pending', 'current']);

    expect(openMonths(year).map((month) => month.month)).toEqual([3, 4, 5]);
  });

  it('tells whether a date falls in a closed month of that year', () => {
    const year = periodYear(2026, ['closed', 'pending']);

    expect(isClosedDate(year, '2026-01-20')).toBe(true);
    expect(isClosedDate(year, '2026-02-01')).toBe(false);
    // Otro año u otro formato no se dan por cerrados con estos datos.
    expect(isClosedDate(year, '2025-01-20')).toBe(false);
    expect(isClosedDate(year, 'not a date')).toBe(false);
  });

  it('opens a year on its oldest pending month, then the current one, then December', () => {
    expect(defaultMonthOf(periodYear(2026, ['closed', 'pending', 'pending', 'current']), '2026-04-10')).toBe(2);
    expect(defaultMonthOf(periodYear(2026, ['closed', 'closed', 'closed', 'current']), '2026-04-10')).toBe(4);
    expect(defaultMonthOf(periodYear(2025, Array(12).fill('closed')), '2026-04-10')).toBe(12);
  });
});

describe('PeriodError', () => {
  it('recognizes only the codes of this domain', () => {
    expect(isPeriodErrorCode(PeriodErrorCode.Closed)).toBe(true);
    expect(isPeriodErrorCode('CATEGORY_NOT_FOUND')).toBe(false);
    expect(isPeriodErrorCode(undefined)).toBe(false);
  });

  it('keeps the message to show and the code, which is null when unknown', () => {
    const error = new PeriodError('Already closed.', PeriodErrorCode.AlreadyClosed);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PeriodError');
    expect(error.message).toBe('Already closed.');
    expect(error.code).toBe('PERIOD_ALREADY_CLOSED');
    expect(new PeriodError('Oops').code).toBeNull();
  });
});
