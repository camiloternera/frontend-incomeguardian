import { AbstractControl, ValidationErrors } from '@angular/forms';
import { normalizeAmount } from '@shared/money/amount-input';
import {
  TRANSACTION_AMOUNT_MAX_DECIMALS,
  TRANSACTION_AMOUNT_MAX_INTEGER_DIGITS,
} from '../../domain/transaction';

/** El parser vive en `@shared/money`: lo comparten los formularios de movimientos y de presupuesto. */
export { normalizeAmount, parseAmount } from '@shared/money/amount-input';

/**
 * Valida el monto con las reglas del backend (NUMERIC(18,3) y monto positivo): obligatorio,
 * número mayor que cero, hasta 2 decimales y 15 cifras enteras.
 */
export function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = (control.value ?? '').trim();

  if (!value) {
    return { required: true };
  }

  const normalized = normalizeAmount(value);

  if (normalized === null) {
    return { amountInvalid: true };
  }

  const [integer, decimals = ''] = normalized.split('.');

  if (decimals.length > TRANSACTION_AMOUNT_MAX_DECIMALS) {
    return { amountInvalid: true };
  }

  if (integer.replace(/^0+(?=\d)/, '').length > TRANSACTION_AMOUNT_MAX_INTEGER_DIGITS) {
    return { amountTooLarge: true };
  }

  return Number(normalized) > 0 ? null : { amountNotPositive: true };
}
