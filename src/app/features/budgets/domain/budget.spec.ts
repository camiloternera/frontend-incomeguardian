import {
  BudgetRow,
  BudgetSummary,
  barPercent,
  blocksOf,
  daysLeftInMonth,
  hasBudget,
  parseMonth,
  shiftMonth,
  totalPercent,
  usageOf,
} from './budget';

function row(overrides: Partial<BudgetRow>): BudgetRow {
  return {
    categoryId: 1,
    categoryName: 'Mercado',
    categoryType: 'expense',
    currency: 'COP',
    budgetAmount: 100,
    spentAmount: 40,
    availableAmount: 60,
    percentUsed: 40,
    recurringAmount: null,
    source: 'recurring',
    ...overrides,
  };
}

describe('usageOf y barPercent', () => {
  it('distingue disponible, completo y sobregiro', () => {
    expect(usageOf(row({}))).toBe('partial');
    expect(barPercent(row({}))).toBe(40);
    expect(usageOf(row({ spentAmount: 100 }))).toBe('full');
    expect(usageOf(row({ spentAmount: 125 }))).toBe('over');
    expect(barPercent(row({ spentAmount: 125 }))).toBe(100);
  });

  it('trata un tope propio de 0 como pausado y la fila sin tope como sin presupuesto', () => {
    expect(usageOf(row({ source: 'month', budgetAmount: 0, spentAmount: 0 }))).toBe('paused');
    expect(barPercent(row({ source: 'month', budgetAmount: 0, spentAmount: 0 }))).toBe(0);
    expect(usageOf(row({ source: 'none', budgetAmount: 0, spentAmount: 38 }))).toBe('unbudgeted');
    expect(barPercent(row({ source: 'none', budgetAmount: 0, spentAmount: 38 }))).toBe(100);
  });
});

describe('totalPercent', () => {
  it('redondea y no divide por cero', () => {
    expect(totalPercent({ currency: 'COP', budget: 3490000, spent: 2368100, available: 1121900 })).toBe(68);
    expect(totalPercent({ currency: 'COP', budget: 0, spent: 10, available: -10 })).toBeNull();
  });
});

describe('blocksOf', () => {
  it('agrupa por moneda con los pesos primero', () => {
    const summary: BudgetSummary = {
      year: 2026,
      month: 11,
      isClosed: false,
      rows: [row({ categoryId: 8, currency: 'USD' }), row({ categoryId: 1 }), row({ categoryId: 2 })],
      totals: [
        { currency: 'USD', budget: 100, spent: 40, available: 60 },
        { currency: 'COP', budget: 200, spent: 80, available: 120 },
      ],
    };

    const blocks = blocksOf(summary);

    expect(blocks.map((block) => block.currency)).toEqual(['COP', 'USD']);
    expect(blocks[0].rows.map((item) => item.categoryId)).toEqual([1, 2]);
    expect(blocks[1].total.budget).toBe(100);
  });
});

describe('hasBudget', () => {
  it('solo cuenta los topes de esa moneda, no las filas sin tope', () => {
    const summary: BudgetSummary = {
      year: 2026,
      month: 11,
      isClosed: false,
      rows: [row({ categoryId: 1 }), row({ categoryId: 5, source: 'none' })],
      totals: [],
    };

    expect(hasBudget(summary, { categoryId: 1, currency: 'COP' })).toBe(true);
    expect(hasBudget(summary, { categoryId: 1, currency: 'USD' })).toBe(false);
    expect(hasBudget(summary, { categoryId: 5, currency: 'COP' })).toBe(false);
  });
});

describe('meses', () => {
  it('cuenta los días que faltan sin el de hoy', () => {
    expect(daysLeftInMonth('2026-11-09')).toBe(21);
    expect(daysLeftInMonth('2026-02-28')).toBe(0);
  });

  it('lee y desplaza meses', () => {
    expect(parseMonth('2026-10')).toEqual({ year: 2026, month: 10 });
    expect(parseMonth('2026-00')).toBeNull();
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});
