import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Como `Validators.required`, pero también rechaza un texto que solo tiene espacios, igual que el backend. */
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return (control.value ?? '').trim() ? null : { required: true };
}
