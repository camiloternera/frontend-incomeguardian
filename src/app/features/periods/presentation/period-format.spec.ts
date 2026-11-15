import '@core/i18n/locale-data';
import {
  capitalized,
  formatAmount,
  formatDay,
  formatDayMonth,
  formatInstant,
  formatRate,
  monthName,
  monthShort,
  monthYear,
} from './period-format';

/** Intl usa espacios duros entre símbolo y número; se normalizan para comparar. */
function plain(text: string): string {
  return text.replace(/[  ]/g, ' ');
}

describe('period format', () => {
  it('names the month in the active language', () => {
    expect(monthName(10, 'es-CO')).toBe('octubre');
    expect(monthName(10, 'en-US')).toBe('October');
    expect(capitalized(monthName(10, 'es-CO'), 'es-CO')).toBe('Octubre');
  });

  it('names the month with its year in the active language', () => {
    expect(monthYear(2025, 3, 'es-CO')).toBe('marzo de 2025');
    expect(monthYear(2025, 3, 'en-US')).toBe('March 2025');
    expect(monthYear(2026, 12, 'en-US')).toBe('December 2026');
    expect(monthYear(2026, 1, 'es-CO')).toBe('enero de 2026');
  });

  it('abbreviates the month for the grid without the Spanish period', () => {
    expect(monthShort(1, 'es-CO')).toBe('Ene');
    expect(monthShort(1, 'en-US')).toBe('Jan');
    expect(monthShort(9, 'es-CO')).not.toContain('.');
  });

  it('writes a day with the month in letters in both languages', () => {
    expect(formatDay('2026-11-05', 'es-CO')).toBe('5 nov 2026');
    expect(formatDay('2026-11-05', 'en-US')).toBe('Nov 5, 2026');
    expect(formatDayMonth('2026-11-08', 'es-CO')).toBe('8 nov');
    expect(formatDayMonth('2026-11-08', 'en-US')).toBe('Nov 8');
  });

  it('shows a backend instant in Colombian time', () => {
    // 03:00 UTC del 1 de noviembre es todavía 31 de octubre en Bogotá.
    expect(formatInstant('2026-11-01T03:00:00Z', 'en-US')).toBe('Oct 31, 2026');
    expect(formatInstant('2026-11-01T05:00:00Z', 'es-CO')).toBe('1 nov 2026');
  });

  it('formats amounts without decimals in COP and with two in USD', () => {
    expect(plain(formatAmount(1_250_000, 'COP', 'es-CO'))).toBe('$ 1.250.000');
    expect(formatAmount(320.5, 'USD', 'en-US')).toBe('$320.50');
  });

  it('formats the savings rate that arrives from 0 to 100', () => {
    expect(formatRate(53.3, 'en-US')).toBe('53.3%');
    expect(formatRate(53.3, 'es-CO')).toBe('53,3%');
  });
});
