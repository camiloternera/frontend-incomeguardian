import { FormControl } from '@angular/forms';
import { amountValidator, normalizeAmount, parseAmount } from './amount.validator';

function errorsFor(value: string) {
  return amountValidator(new FormControl(value, { nonNullable: true }));
}

describe('amountValidator', () => {
  it('accepts positive amounts with up to two decimals and thousands separators', () => {
    expect(errorsFor('400000')).toBeNull();
    expect(errorsFor('400.000')).toBeNull();
    expect(errorsFor('1.234,56')).toBeNull();
    expect(errorsFor('1,234.56')).toBeNull();
    expect(errorsFor('12,5')).toBeNull();
    expect(errorsFor('0.01')).toBeNull();
    expect(errorsFor('9'.repeat(15))).toBeNull();
  });

  it('rejects empty, malformed, negative, zero and oversized values', () => {
    expect(errorsFor('  ')).toEqual({ required: true });
    expect(errorsFor('abc')).toEqual({ amountInvalid: true });
    expect(errorsFor('-100')).toEqual({ amountInvalid: true });
    expect(errorsFor('1.2.3,4.5')).toEqual({ amountInvalid: true });
    expect(errorsFor('1.234.56')).toEqual({ amountInvalid: true });
    expect(errorsFor('12.3456')).toEqual({ amountInvalid: true });
    expect(errorsFor('1,234,5')).toEqual({ amountInvalid: true });
    expect(errorsFor('0')).toEqual({ amountNotPositive: true });
    expect(errorsFor('0,00')).toEqual({ amountNotPositive: true });
    expect(errorsFor('9'.repeat(16))).toEqual({ amountTooLarge: true });
  });

  it('parses es-CO and en-US styles to the same number', () => {
    expect(parseAmount(' 400.000 ')).toBe(400000);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('101,27')).toBe(101.27);
    expect(parseAmount('1.000.000')).toBe(1000000);
    expect(parseAmount('x')).toBeNaN();
    expect(normalizeAmount('1.5')).toBe('1.5');
  });
});
