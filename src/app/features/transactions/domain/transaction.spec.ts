import {
  Transaction,
  categoryAppliesTo,
  compareMonths,
  dayOf,
  exceedsAvailable,
  groupByDay,
  monthRange,
  parseMonth,
  shiftMonth,
  hasInstallments,
  isCardAdvanceRoute,
  isUsableAccount,
  previewDestinationAmount,
  roundAwayFromZero,
  TransactionAccountOption,
} from './transaction';
import { ADVANCE_FEE_ERROR_CODES, TransactionErrorCode, isTransactionErrorCode } from './transaction-error';

describe('previewDestinationAmount', () => {
  it('devuelve el mismo monto cuando las monedas coinciden', () => {
    expect(previewDestinationAmount(400000, 'COP', 'COP', 3950)).toBe(400000);
  });

  it('divide por la TRM de COP a USD y redondea a 2 decimales', () => {
    expect(previewDestinationAmount(400000, 'COP', 'USD', 3950)).toBe(101.27);
  });

  it('multiplica por la TRM de USD a COP', () => {
    expect(previewDestinationAmount(100.5, 'USD', 'COP', 4123.45)).toBe(414406.73);
  });
});

describe('exceedsAvailable', () => {
  const bank = { isCreditCard: false, currentBalance: 85_000, availableCredit: null };
  const card = { isCreditCard: true, currentBalance: -300_000, availableCredit: 1_700_000 };

  it('compara con el saldo en una cuenta normal', () => {
    expect(exceedsAvailable(bank, 100_000)).toEqual({ available: 85_000 });
    expect(exceedsAvailable(bank, 50_000)).toBeNull();
  });

  it('permite gastar exactamente lo disponible', () => {
    expect(exceedsAvailable(bank, 85_000)).toBeNull();
    expect(exceedsAvailable(card, 1_700_000)).toBeNull();
  });

  it('compara con el cupo disponible en una tarjeta, no con su saldo', () => {
    expect(exceedsAvailable(card, 1_700_001)).toEqual({ available: 1_700_000 });
    // El saldo negativo (deuda) no cuenta: lo que manda es el cupo.
    expect(exceedsAvailable(card, 500_000)).toBeNull();
  });

  it('no valida cuando no se conoce el saldo o el cupo', () => {
    expect(exceedsAvailable({ ...bank, currentBalance: null }, 1_000_000_000)).toBeNull();
    expect(exceedsAvailable({ ...card, availableCredit: null }, 1_000_000_000)).toBeNull();
    // Una tarjeta sin cupo no usa su saldo como respaldo.
    expect(exceedsAvailable({ ...card, currentBalance: 5_000_000, availableCredit: null }, 1_000_000_000)).toBeNull();
  });

  it('suma lo que ya descontó el movimiento original al editar', () => {
    expect(exceedsAvailable(bank, 100_000, 15_000)).toBeNull();
    expect(exceedsAvailable(bank, 100_001, 15_000)).toEqual({ available: 100_000 });
    expect(exceedsAvailable(card, 1_750_000, 50_000)).toBeNull();
  });

  it('informa lo disponible aunque el saldo ya sea negativo', () => {
    expect(exceedsAvailable({ ...bank, currentBalance: -20_000 }, 1)).toEqual({ available: -20_000 });
  });

  it('no falla por el redondeo de los decimales', () => {
    // 0.1 + 0.2 da 0.30000000000000004 en punto flotante.
    expect(exceedsAvailable({ ...bank, currentBalance: 0.1 }, 0.3, 0.2)).toBeNull();
    expect(exceedsAvailable({ ...bank, currentBalance: 320.5 }, 320.5)).toBeNull();
    expect(exceedsAvailable({ ...bank, currentBalance: 320.5 }, 320.51)).toEqual({ available: 320.5 });
    expect(exceedsAvailable({ ...bank, currentBalance: 10.335 }, 10.3349999)).toBeNull();
  });
});

describe('roundAwayFromZero', () => {
  it('redondea el punto medio alejándose de cero', () => {
    expect(roundAwayFromZero(1.005)).toBe(1.01);
    expect(roundAwayFromZero(2.675)).toBe(2.68);
    expect(roundAwayFromZero(-1.005)).toBe(-1.01);
  });
});

describe('isUsableAccount', () => {
  const account = (patch: Partial<TransactionAccountOption>): TransactionAccountOption => ({
    id: 1,
    name: 'Nequi',
    currency: 'COP',
    currentBalance: 0,
    isActive: true,
    isCreditCard: false,
    availableCredit: null,
    nextStatementDate: null,
    ...patch,
  });

  it('acepta cuentas activas en COP o USD', () => {
    expect(isUsableAccount(account({ currency: 'USD' }))).toBe(true);
  });

  it('rechaza cuentas desactivadas o en EUR', () => {
    expect(isUsableAccount(account({ isActive: false }))).toBe(false);
    expect(isUsableAccount(account({ currency: 'EUR' }))).toBe(false);
  });
});

describe('categoryAppliesTo', () => {
  it('exige que la categoría sea del mismo tipo que el movimiento', () => {
    const salary = { id: 1, name: 'Salario', type: 'income' as const, isActive: true, code: null };
    expect(categoryAppliesTo(salary, 'income')).toBe(true);
    expect(categoryAppliesTo(salary, 'expense')).toBe(false);
    expect(categoryAppliesTo(salary, 'transfer')).toBe(false);
    expect(categoryAppliesTo({ ...salary, type: 'transfer' }, 'transfer')).toBe(true);
    expect(categoryAppliesTo({ ...salary, type: null }, 'income')).toBe(false);
  });
});

describe('monthRange', () => {
  it('cubre el mes completo en hora de Colombia (UTC-5)', () => {
    expect(monthRange({ year: 2026, month: 11 })).toEqual({
      fromDate: '2026-11-01T05:00:00.000Z',
      toDate: '2026-12-01T04:59:59.999Z',
    });
  });

  it('pasa de diciembre al año siguiente', () => {
    expect(monthRange({ year: 2026, month: 12 }).toDate).toBe('2027-01-01T04:59:59.999Z');
  });
});

describe('shiftMonth y compareMonths', () => {
  it('cruza los límites del año', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('ordena por año y mes', () => {
    expect(compareMonths({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBeLessThan(0);
    expect(compareMonths({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(0);
  });
});

describe('parseMonth', () => {
  it('lee YYYY-MM y rechaza lo demás', () => {
    expect(parseMonth('2026-09')).toEqual({ year: 2026, month: 9 });
    expect(parseMonth('2026-13')).toBeNull();
    expect(parseMonth('2026-9')).toBeNull();
    expect(parseMonth(null)).toBeNull();
  });
});

function item(id: number, type: Transaction['type'], amount: number, date: string): Transaction {
  return {
    id,
    type,
    amount,
    date,
    fromAccountId: null,
    toAccountId: null,
    categoryId: null,
    description: null,
    fromCurrency: null,
    toCurrency: null,
    destinationAmount: null,
    exchangeRate: null,
    exchangeRateDate: null,
    installments: 1,
    annualInterestRate: null,
    installmentAmount: null,
    schedule: [],
    canModify: true,
    isCardAdvance: false,
    advanceFee: null,
    feeTransactionId: null,
    parentTransactionId: null,
  };
}

describe('dayOf y groupByDay', () => {
  it('usa el día de Colombia, no el de UTC', () => {
    expect(dayOf('2026-11-10T03:00:00Z')).toBe('2026-11-09');
  });

  it('agrupa los movimientos consecutivos del mismo día sin reordenarlos', () => {
    const items = [
      item(1, 'expense', 1, '2026-11-09T20:00:00Z'),
      item(2, 'income', 1, '2026-11-10T02:00:00Z'),
      item(3, 'transfer', 1, '2026-11-08T15:00:00Z'),
    ];

    expect(groupByDay(items, (entry) => entry.date).map((group) => [group.day, group.items.map((entry) => entry.id)])).toEqual([
      ['2026-11-09', [1, 2]],
      ['2026-11-08', [3]],
    ]);
  });
});

describe('hasInstallments', () => {
  it('solo cuenta las compras a más de una cuota', () => {
    expect(hasInstallments({ installments: 1 })).toBe(false);
    expect(hasInstallments({ installments: 2 })).toBe(true);
    expect(hasInstallments({ installments: 48 })).toBe(true);
  });
});

describe('isCardAdvanceRoute', () => {
  const card = { isCreditCard: true };
  const bank = { isCreditCard: false };

  it('es avance de una tarjeta a una cuenta normal', () => {
    expect(isCardAdvanceRoute(card, bank)).toBe(true);
  });

  it('no es avance entre tarjetas, entre cuentas normales ni hacia una tarjeta', () => {
    expect(isCardAdvanceRoute(card, card)).toBe(false);
    expect(isCardAdvanceRoute(bank, bank)).toBe(false);
    expect(isCardAdvanceRoute(bank, card)).toBe(false);
  });

  it('no es avance mientras falte alguna de las cuentas', () => {
    expect(isCardAdvanceRoute(card, null)).toBe(false);
    expect(isCardAdvanceRoute(null, bank)).toBe(false);
    expect(isCardAdvanceRoute(null, null)).toBe(false);
  });
});

describe('errores de avances', () => {
  it('agrupa los dos códigos de la comisión', () => {
    expect(ADVANCE_FEE_ERROR_CODES).toEqual([TransactionErrorCode.AdvanceFeeNotAllowed, TransactionErrorCode.AdvanceFeeInvalid]);
  });

  it('reconoce los códigos nuevos del backend', () => {
    expect(isTransactionErrorCode('TRANSACTION_ADVANCE_FEE_NOT_ALLOWED')).toBe(true);
    expect(isTransactionErrorCode('TRANSACTION_ADVANCE_FEE_INVALID')).toBe(true);
    expect(isTransactionErrorCode('TRANSACTION_MANAGED_BY_PARENT')).toBe(true);
  });
});
