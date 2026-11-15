import { AbstractControl, ValidationErrors } from '@angular/forms';
import { ACCOUNT_BALANCE_MAX_DECIMALS, ACCOUNT_BALANCE_MAX_INTEGER_DIGITS } from '../../domain/account';

/** Número con signo opcional y coma o punto decimal, como lo escribe una persona. */
const NUMBER = /^-?\d+(?:[.,]\d+)?$/;

/** Convierte el texto del campo en número; acepta coma decimal, habitual en es-CO. Vacío es 0. */
export function parseBalance(value: string): number {
  const text = value.trim();

  return text ? Number(text.replace(',', '.')) : 0;
}

/**
 * Valida el saldo con las mismas reglas que el backend (NUMERIC(18,3)): número con hasta
 * 3 decimales y 15 cifras enteras. Puede ser negativo. Vacío es válido y se guarda como 0.
 */
export function balanceValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = (control.value ?? '').trim();

  if (!value) {
    return null;
  }

  if (!NUMBER.test(value)) {
    return { balanceInvalid: true };
  }

  const [integer, decimals = ''] = value.replace('-', '').split(/[.,]/);

  if (decimals.length > ACCOUNT_BALANCE_MAX_DECIMALS) {
    return { balanceInvalid: true };
  }

  return integer.replace(/^0+(?=\d)/, '').length > ACCOUNT_BALANCE_MAX_INTEGER_DIGITS ? { balanceTooLarge: true } : null;
}
