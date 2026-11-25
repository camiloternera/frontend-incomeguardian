import { FormControl } from '@angular/forms';
import { amountValidator, parseAmount } from './amount.validator';

describe('Amount review regressions', () => {
  it('review A5: rejects a value whose numeric conversion exceeds the 15-digit limit', () => {
    const text = '999999999999999.99';
    const numeric = parseAmount(text);
    const errors = amountValidator(new FormControl(text, { nonNullable: true }));
    // A valid input must not silently become a different amount.
    expect(errors !== null || String(numeric) === text).toBe(true);
  });
});
