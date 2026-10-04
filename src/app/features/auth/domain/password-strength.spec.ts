import { passwordStrength } from './password-strength';

describe('passwordStrength', () => {
  it('is 0 for an empty password', () => {
    expect(passwordStrength('')).toBe(0);
  });

  it('is 1 when only the minimum length is met', () => {
    expect(passwordStrength('abcdefgh')).toBe(1);
  });

  it('is 2 with mixed case', () => {
    expect(passwordStrength('abcdEFGH')).toBe(2);
  });

  it('is 3 with length, mixed case and a digit or symbol', () => {
    expect(passwordStrength('abcdEFGH1')).toBe(3);
    expect(passwordStrength('a-much-longer-pass!')).toBe(3);
  });
});
