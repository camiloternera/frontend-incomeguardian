import { CushionCandidate, CushionCurrency, clampGoal, cushionState, cushionSurplus, previewSelection, sortCurrencies } from './cushion';

function row(changes: Partial<CushionCurrency> = {}): CushionCurrency {
  return {
    currency: 'COP',
    savings: 9_360_000,
    averageMonthlySpent: 3_900_000,
    monthsUsed: 5,
    monthsCovered: 2.4,
    reason: null,
    goalAmount: 23_400_000,
    missing: 14_040_000,
    accounts: [],
    ...changes,
  };
}

describe('cushionState', () => {
  it('follows the contract fields', () => {
    expect(cushionState(row())).toBe('normal');
    expect(cushionState(row({ savings: 0, monthsCovered: 0, missing: 23_400_000 }))).toBe('zero');
    expect(cushionState(row({ monthsCovered: 6.8, missing: 0 }))).toBe('goalReached');
    expect(cushionState(row({ monthsCovered: null, reason: 'noPreviousMonths' }))).toBe('noPreviousMonths');
    expect(cushionState(row({ monthsCovered: null, reason: 'noSpending' }))).toBe('noSpending');
  });
});

describe('cushionSurplus', () => {
  it('is what the savings exceed the goal by, never negative', () => {
    expect(cushionSurplus({ savings: 26_520_000, goalAmount: 23_400_000 })).toBe(3_120_000);
    expect(cushionSurplus({ savings: 1, goalAmount: 23_400_000 })).toBe(0);
    expect(cushionSurplus({ savings: 1, goalAmount: null })).toBe(0);
  });
});

describe('sortCurrencies', () => {
  it('puts pesos first', () => {
    expect(sortCurrencies([{ currency: 'USD' }, { currency: 'EUR' }, { currency: 'COP' }]).map((item) => item.currency)).toEqual(['COP', 'EUR', 'USD']);
  });
});

describe('clampGoal', () => {
  it('keeps the goal between 1 and 24', () => {
    expect(clampGoal(0)).toBe(1);
    expect(clampGoal(25)).toBe(24);
    expect(clampGoal(9)).toBe(9);
  });
});

describe('previewSelection', () => {
  const candidates: CushionCandidate[] = [
    { id: 1, name: 'Davivienda', currency: 'COP', balance: 6_000_000, isCushion: true },
    { id: 2, name: 'Nu', currency: 'COP', balance: 3_360_000, isCushion: true },
    { id: 3, name: 'Wise', currency: 'USD', balance: 1_200, isCushion: false },
    { id: 4, name: 'Sobregiro', currency: 'COP', balance: -20_000_000, isCushion: false },
  ];

  it('adds the selected accounts per currency and compares them with the average', () => {
    const [cop, usd] = previewSelection(candidates, new Set([1, 2, 3]), { COP: 3_900_000 }, 6);

    expect(cop).toEqual({ currency: 'COP', savings: 9_360_000, monthsCovered: 2.4, goalAmount: 23_400_000, missing: 14_040_000 });
    expect(usd).toEqual({ currency: 'USD', savings: 1_200, monthsCovered: null, goalAmount: null, missing: null });
  });

  it('counts a negative total as zero, like the backend', () => {
    const [cop] = previewSelection(candidates, new Set([4]), { COP: 1_000_000 }, 2);

    expect(cop.monthsCovered).toBe(0);
    expect(cop.missing).toBe(2_000_000);
  });

  it('is empty without a selection', () => {
    expect(previewSelection(candidates, new Set(), { COP: 1 }, 6)).toEqual([]);
  });
});
