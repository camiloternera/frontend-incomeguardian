import {
  Transaction,
  categoryAppliesTo,
  compareMonths,
  dayOf,
  groupByDay,
  monthRange,
  parseMonth,
  shiftMonth,
  hasInstallments,
  isUsableAccount,
  previewDestinationAmount,
  roundAwayFromZero,
  TransactionAccountOption,
} from './transaction';

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
