import '@core/i18n/locale-data';
import { formatMoney, moneyDigits } from './money-format';
import { MoneyPipe } from './money.pipe';

describe('formatMoney', () => {
  it('separates the COP code from the number with a non-breaking space in English', () => {
    expect(formatMoney(300_000, 'COP', 'en-US')).toBe('COP 300,000');
    expect(formatMoney(300_000, 'COP', 'en-US')).not.toContain(' ');
  });

  it('keeps the minus sign before the code of a negative amount', () => {
    expect(formatMoney(-300_000, 'COP', 'en-US')).toBe('-COP 300,000');
  });

  it('leaves a currency with a symbol glued to the number in English', () => {
    expect(formatMoney(25.5, 'USD', 'en-US')).toBe('$25.50');
    expect(formatMoney(-25.5, 'USD', 'en-US')).toBe('-$25.50');
  });

  it('does not change the Spanish format', () => {
    expect(formatMoney(300_000, 'COP', 'es-CO')).toBe('$ 300.000');
    expect(formatMoney(25.5, 'USD', 'es-CO')).toBe('US$ 25,50');
  });

  it('shows pesos without cents when whole, and up to three decimals otherwise', () => {
    expect(moneyDigits('COP', 1000)).toBe('1.0-0');
    expect(moneyDigits('COP', 1000.5)).toBe('1.2-3');
    expect(moneyDigits('USD', 25)).toBe('1.2-3');
    expect(formatMoney(1000.5, 'COP', 'en-US')).toBe('COP 1,000.50');
    expect(formatMoney(10.125, 'USD', 'en-US')).toBe('$10.125');
    expect(formatMoney(25, 'USD', 'en-US')).toBe('$25.00');
  });

  it('respects explicit digits', () => {
    expect(formatMoney(300_000, 'COP', 'en-US', '1.2-2')).toBe('COP 300,000.00');
  });
});

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('formats like formatMoney', () => {
    expect(pipe.transform(300_000, 'COP', undefined, 'en-US')).toBe('COP 300,000');
    expect(pipe.transform(300_000, 'COP', '1.2-2', 'en-US')).toBe('COP 300,000.00');
    expect(pipe.transform(0, 'COP', undefined, 'en-US')).toBe('COP 0');
  });

  it('returns null without an amount', () => {
    expect(pipe.transform(null, 'COP', undefined, 'en-US')).toBeNull();
    expect(pipe.transform(undefined, 'COP', undefined, 'en-US')).toBeNull();
  });
});
