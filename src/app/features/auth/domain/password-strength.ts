export type PasswordStrength = 0 | 1 | 2 | 3;

export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrength, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
};

export function passwordStrength(password: string): PasswordStrength {
  if (!password) {
    return 0;
  }

  const checks = [
    password.length >= 8,
    password.length >= 12 || (/[a-z]/.test(password) && /[A-Z]/.test(password)),
    /\d/.test(password) || /[^\w\s]/.test(password),
  ];

  return checks.filter(Boolean).length as PasswordStrength;
}
