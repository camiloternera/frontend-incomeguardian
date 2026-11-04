import {
  categoryAppliesTo,
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
  it('filtra por la clase de la categoría', () => {
    const salary = { id: 1, name: 'Salario', kind: 'income' as const, isActive: true };
    expect(categoryAppliesTo(salary, 'income')).toBe(true);
    expect(categoryAppliesTo(salary, 'expense')).toBe(false);
    expect(categoryAppliesTo({ ...salary, kind: 'both' }, 'expense')).toBe(true);
  });
});
