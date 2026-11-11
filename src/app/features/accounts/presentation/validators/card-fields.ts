import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CARD_DAY_MAX, CARD_DAY_MIN } from '../../domain/account';
import { parseBalance } from './balance.validator';

/** Indica si el día de corte o de pago está en el rango que admite el backend. */
function isCardDay(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= CARD_DAY_MIN && value <= CARD_DAY_MAX;
}

/**
 * Validador del grupo para una tarjeta (`kind` = `credit_card`): la deuda se escribe en positivo,
 * el cupo es opcional pero mayor que 0, y el día de corte y el de pago son obligatorios. En una
 * cuenta normal no aplica. El formato numérico lo valida `balanceValidator` en cada campo.
 */
export const cardFieldsValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  if (group.get('kind')?.value !== 'credit_card') {
    return null;
  }

  const errors: ValidationErrors = {};
  const debt = String(group.get('initialBalance')?.value ?? '').trim();
  const limit = String(group.get('creditLimit')?.value ?? '').trim();

  if (debt.startsWith('-')) {
    errors['debtNegative'] = true;
  }
  if (limit && !(parseBalance(limit) > 0)) {
    errors['creditLimitInvalid'] = true;
  }
  if (!isCardDay(group.get('statementDay')?.value)) {
    errors['statementDayRequired'] = true;
  }
  if (!isCardDay(group.get('paymentDay')?.value)) {
    errors['paymentDayRequired'] = true;
  }

  return Object.keys(errors).length ? errors : null;
};
