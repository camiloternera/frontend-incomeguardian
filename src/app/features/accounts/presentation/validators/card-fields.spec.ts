import { FormControl, FormGroup } from '@angular/forms';
import { cardFieldsValidator } from './card-fields';

interface CardValues {
  kind: string;
  initialBalance: string;
  creditLimit: string;
  statementDay: number | null;
  paymentDay: number | null;
}

const VALID_CARD: CardValues = {
  kind: 'credit_card',
  initialBalance: '150000',
  creditLimit: '2000000',
  statementDay: 15,
  paymentDay: 5,
};

function errorsFor(values: Partial<CardValues>) {
  const merged = { ...VALID_CARD, ...values };

  return cardFieldsValidator(
    new FormGroup({
      kind: new FormControl(merged.kind),
      initialBalance: new FormControl(merged.initialBalance),
      creditLimit: new FormControl(merged.creditLimit),
      statementDay: new FormControl(merged.statementDay),
      paymentDay: new FormControl(merged.paymentDay),
    }),
  );
}

describe('cardFieldsValidator', () => {
  it('accepts a complete card, and a card without a limit', () => {
    expect(errorsFor({})).toBeNull();
    expect(errorsFor({ creditLimit: '' })).toBeNull();
    expect(errorsFor({ creditLimit: '  ' })).toBeNull();
    expect(errorsFor({ initialBalance: '0' })).toBeNull();
  });

  it('validates nothing on a standard account', () => {
    expect(
      errorsFor({ kind: 'standard', initialBalance: '-500', creditLimit: '-1', statementDay: null, paymentDay: null }),
    ).toBeNull();
  });

  it('asks for the debt in positive', () => {
    expect(errorsFor({ initialBalance: '-150000' })).toEqual({ debtNegative: true });
    expect(errorsFor({ initialBalance: ' -1' })).toEqual({ debtNegative: true });
  });

  it('rejects a limit that is not greater than 0', () => {
    expect(errorsFor({ creditLimit: '0' })).toEqual({ creditLimitInvalid: true });
    expect(errorsFor({ creditLimit: '-100' })).toEqual({ creditLimitInvalid: true });
    expect(errorsFor({ creditLimit: 'abc' })).toEqual({ creditLimitInvalid: true });
    expect(errorsFor({ creditLimit: '1500,5' })).toBeNull();
  });

  it('requires a statement day between 1 and 31', () => {
    expect(errorsFor({ statementDay: null })).toEqual({ statementDayRequired: true });
    expect(errorsFor({ statementDay: 0 })).toEqual({ statementDayRequired: true });
    expect(errorsFor({ statementDay: 32 })).toEqual({ statementDayRequired: true });
    expect(errorsFor({ statementDay: 1.5 })).toEqual({ statementDayRequired: true });
    expect(errorsFor({ statementDay: 1 })).toBeNull();
    expect(errorsFor({ statementDay: 31 })).toBeNull();
  });

  it('requires a payment day between 1 and 31', () => {
    expect(errorsFor({ paymentDay: null })).toEqual({ paymentDayRequired: true });
    expect(errorsFor({ paymentDay: 0 })).toEqual({ paymentDayRequired: true });
    expect(errorsFor({ paymentDay: 32 })).toEqual({ paymentDayRequired: true });
  });

  it('reports every failing field at once', () => {
    expect(
      errorsFor({ initialBalance: '-1', creditLimit: '0', statementDay: null, paymentDay: null }),
    ).toEqual({ debtNegative: true, creditLimitInvalid: true, statementDayRequired: true, paymentDayRequired: true });
  });
});
