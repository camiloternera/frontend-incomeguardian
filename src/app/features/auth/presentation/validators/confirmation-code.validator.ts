import { AbstractControl, ValidationErrors } from '@angular/forms';
import { isConfirmationCodeComplete } from '../../domain/confirmation-code';

/** Joins the digit controls and checks the code is complete. */
export function confirmationCodeComplete(group: AbstractControl): ValidationErrors | null {
  const digits = group.value as { code?: string[] } | null;
  const code = (digits?.code ?? []).join('');

  return isConfirmationCodeComplete(code) ? null : { incompleteCode: true };
}
