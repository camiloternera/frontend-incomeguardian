import { FormControl } from '@angular/forms';
import { balanceValidator, parseBalance } from './balance.validator';

function errorsFor(value: string) {
  return balanceValidator(new FormControl(value, { nonNullable: true }));
}

describe('balanceValidator', () => {
  it('accepts negatives, commas and up to three decimals', () => {
    expect(errorsFor('0')).toBeNull();
    expect(errorsFor('-250000')).toBeNull();
    expect(errorsFor('1250,5')).toBeNull();
    expect(errorsFor('10.125')).toBeNull();
    expect(errorsFor('9'.repeat(15))).toBeNull();
  });

  it('accepts an empty balance, which is saved as 0', () => {
    expect(errorsFor('')).toBeNull();
    expect(errorsFor('  ')).toBeNull();
    expect(parseBalance('')).toBe(0);
    expect(parseBalance('   ')).toBe(0);
  });

  it('rejects malformed and oversized values', () => {
    expect(errorsFor('1.000.000')).toEqual({ balanceInvalid: true });
    expect(errorsFor('abc')).toEqual({ balanceInvalid: true });
    expect(errorsFor('1.2345')).toEqual({ balanceInvalid: true });
    expect(errorsFor('9'.repeat(16))).toEqual({ balanceTooLarge: true });
  });

  it('parses a comma as the decimal separator', () => {
    expect(parseBalance(' -1250,75 ')).toBe(-1250.75);
  });
});
