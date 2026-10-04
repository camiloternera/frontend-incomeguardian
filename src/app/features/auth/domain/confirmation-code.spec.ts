import { CONFIRMATION_CODE_LENGTH, isConfirmationCodeComplete, onlyDigits } from './confirmation-code';

describe('confirmation code', () => {
  it('keeps digits only', () => {
    expect(onlyDigits('1a2-3 4')).toBe('1234');
    expect(onlyDigits('abc')).toBe('');
  });

  it('trims to the code length', () => {
    expect(onlyDigits('1234567890')).toBe('123456');
    expect(onlyDigits('1234567890', 1)).toBe('1');
  });

  it('accepts a complete code only', () => {
    expect(isConfirmationCodeComplete('123456')).toBe(true);
    expect(isConfirmationCodeComplete('12345')).toBe(false);
    expect(isConfirmationCodeComplete('1234567')).toBe(false);
    expect(isConfirmationCodeComplete('12345a')).toBe(false);
    expect(isConfirmationCodeComplete('')).toBe(false);
  });

  it('exposes the expected length', () => {
    expect(CONFIRMATION_CODE_LENGTH).toBe(6);
  });
});
