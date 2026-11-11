import {
  cardDayOf,
  compareCardMonths,
  nextStatementDate,
  paymentDueDate,
  shiftCardMonth,
  statementDate,
  statementMonthFor,
} from './credit-card-calendar';

/** Replica CreditCardCalendarTests del backend. */
describe('credit card calendar', () => {
  describe('statementMonthFor', () => {
    it.each([
      ['2026-11-15', 15, { year: 2026, month: 11 }],
      ['2026-11-16', 15, { year: 2026, month: 12 }],
      ['2026-12-20', 15, { year: 2027, month: 1 }],
      ['2026-02-28', 31, { year: 2026, month: 2 }],
      ['2026-03-01', 31, { year: 2026, month: 3 }],
    ])('a purchase on %s with statement day %i falls in %o', (day, statementDay, month) => {
      expect(statementMonthFor(day, statementDay)).toEqual(month);
    });
  });

  describe('statementDate', () => {
    it('uses the last day when the month is shorter', () => {
      expect(statementDate({ year: 2026, month: 2 }, 31)).toBe('2026-02-28');
      expect(statementDate({ year: 2028, month: 2 }, 31)).toBe('2028-02-29');
    });

    it('pads the month and the day', () => {
      expect(statementDate({ year: 2026, month: 3 }, 5)).toBe('2026-03-05');
    });
  });

  describe('paymentDueDate', () => {
    it.each([
      [{ year: 2026, month: 11 }, 15, 28, '2026-11-28'],
      [{ year: 2026, month: 11 }, 15, 5, '2026-12-05'],
      [{ year: 2026, month: 11 }, 15, 15, '2026-12-15'],
      [{ year: 2026, month: 1 }, 31, 31, '2026-02-28'],
    ])('statement of %o, cut %i and pay %i → %s', (month, statementDay, paymentDay, due) => {
      expect(paymentDueDate(month, statementDay, paymentDay)).toBe(due);
    });
  });

  describe('nextStatementDate', () => {
    it.each([
      ['2026-11-08', '2026-11-15'],
      ['2026-11-15', '2026-11-15'],
      ['2026-11-16', '2026-12-15'],
    ])('on %s with cut 15 → %s', (today, next) => {
      expect(nextStatementDate(today, 15)).toBe(next);
    });
  });

  describe('months', () => {
    it('shifts across years in both directions', () => {
      expect(shiftCardMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
      expect(shiftCardMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
      expect(shiftCardMonth({ year: 2026, month: 11 }, -23)).toEqual({ year: 2024, month: 12 });
    });

    it('compares months', () => {
      expect(compareCardMonths({ year: 2026, month: 1 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
      expect(compareCardMonths({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(0);
      expect(compareCardMonths({ year: 2026, month: 2 }, { year: 2026, month: 3 })).toBeLessThan(0);
    });
  });

  it('takes the day in Colombian time', () => {
    // 03:00 UTC del 16 todavía es el 15 en Bogotá (UTC−5).
    expect(cardDayOf(new Date('2026-11-16T03:00:00Z'))).toBe('2026-11-15');
    expect(cardDayOf(new Date('2026-11-16T05:00:00Z'))).toBe('2026-11-16');
  });
});
