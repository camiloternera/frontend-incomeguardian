import {
  addDays,
  addMonths,
  clampDate,
  formatCalendarDate,
  monthGrid,
  parseCalendarDate,
  startOfWeek,
} from './calendar-date';

describe('calendar-date', () => {
  it('parses only real YYYY-MM-DD dates', () => {
    expect(parseCalendarDate('2026-11-03')?.toISOString()).toBe('2026-11-03T00:00:00.000Z');
    expect(parseCalendarDate('2026-02-31')).toBeNull();
    expect(parseCalendarDate('03/11/2026')).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
  });

  it('adds days and months across month and year boundaries', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('builds a six-week grid starting on Sunday', () => {
    const grid = monthGrid('2026-10-20');

    expect(grid.length).toBe(42);
    expect(grid[0]).toBe('2026-09-27');
    expect(grid[4]).toBe('2026-10-01');
    expect(grid[41]).toBe('2026-11-07');
    expect(startOfWeek('2026-11-04')).toBe('2026-11-01');
  });

  it('clamps to the range', () => {
    expect(clampDate('2026-11-10', null, '2026-11-03')).toBe('2026-11-03');
    expect(clampDate('2026-01-01', '2026-02-01', null)).toBe('2026-02-01');
    expect(clampDate('2026-05-05', null, null)).toBe('2026-05-05');
  });

  it('formats without shifting the day by time zone', () => {
    expect(formatCalendarDate('2026-11-01', 'en-US', { dateStyle: 'medium' })).toBe('Nov 1, 2026');
  });
});
