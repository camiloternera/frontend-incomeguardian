import { DashboardOverview } from './dashboard-overview';
import { cushionMonths, groupByDay, monthOutlook, previousAverages, projectedSavingsRate } from './overview-insights';
import { RecentMovement } from './recent-movement';

function overview(changes: Partial<DashboardOverview> = {}): DashboardOverview {
  return {
    month: '2026-10',
    asOf: '2026-10-20',
    currency: 'COP',
    income: 6_200_000,
    incomePayments: 3,
    expenses: 2_360_000,
    committed: 1_000_000,
    savings: 9_400_000,
    goals: { savingsRate: 0.3, cushionMonths: 6 },
    cashFlow: [
      { month: '2026-05', income: 4_100_000, expenses: 3_700_000 },
      { month: '2026-06', income: 6_800_000, expenses: 4_200_000 },
      { month: '2026-07', income: 3_200_000, expenses: 3_900_000 },
      { month: '2026-08', income: 5_900_000, expenses: 3_600_000 },
      { month: '2026-09', income: 6_200_000, expenses: 4_000_000 },
      { month: '2026-10', income: 6_200_000, expenses: 2_360_000 },
    ],
    categories: [],
    ...changes,
  };
}

function movement(id: number, day: string): RecentMovement {
  return {
    id,
    kind: 'expense',
    date: `${day}T15:00:00Z`,
    day,
    description: null,
    amount: 1,
    currency: 'COP',
    categoryName: 'Comida',
    isCardPayment: false,
    installments: 1,
    fromAccountName: 'Nequi',
    toAccountName: null,
    destination: null,
  };
}

describe('monthOutlook', () => {
  it('leaves what is not spent nor committed as available', () => {
    const outlook = monthOutlook(overview());

    expect(outlook.available).toBe(2_840_000);
    expect(outlook.overspent).toBe(false);
  });

  it('splits the income into spent, committed and available', () => {
    const outlook = monthOutlook(overview());

    expect(outlook.spentShare).toBeCloseTo(0.381, 3);
    expect(outlook.committedShare).toBeCloseTo(0.161, 3);
    expect(outlook.availableShare).toBeCloseTo(0.458, 3);
  });

  it('counts the days left after the as-of date and spreads the available money over them', () => {
    const outlook = monthOutlook(overview());

    expect(outlook.daysLeft).toBe(11);
    expect(outlook.perDay).toBeCloseTo(258_181.8, 1);
    expect(outlook.monthEnd).toBe('2026-10-31');
  });

  it('flags an overspent month and keeps the bar inside the income', () => {
    const outlook = monthOutlook(overview({ expenses: 5_800_000 }));

    expect(outlook.available).toBe(-600_000);
    expect(outlook.overspent).toBe(true);
    expect(outlook.perDay).toBeNull();
    expect(outlook.availableShare).toBe(0);
    expect(outlook.spentShare + outlook.committedShare).toBeCloseTo(1, 5);
  });

  it('has no shares nor daily amount without income', () => {
    const outlook = monthOutlook(overview({ income: 0, expenses: 0, committed: 0 }));

    expect(outlook.spentShare).toBe(0);
    expect(outlook.availableShare).toBe(0);
    expect(outlook.perDay).toBeNull();
  });

  it('has no days left on the last day of the month', () => {
    const outlook = monthOutlook(overview({ asOf: '2026-10-31' }));

    expect(outlook.daysLeft).toBe(0);
    expect(outlook.perDay).toBeNull();
  });
});

describe('previousAverages', () => {
  it('averages only the months before the current one', () => {
    const averages = previousAverages(overview());

    expect(averages?.months).toBe(5);
    expect(averages?.income).toBe(5_240_000);
    expect(averages?.expenses).toBe(3_880_000);
  });

  it('is null when there is no earlier month', () => {
    expect(previousAverages(overview({ cashFlow: [{ month: '2026-10', income: 1, expenses: 1 }] }))).toBeNull();
  });
});

describe('cushionMonths', () => {
  it('divides the savings by the average monthly spending', () => {
    expect(cushionMonths(9_400_000, 3_880_000)).toBeCloseTo(2.42, 2);
  });

  it('is null without an average to divide by', () => {
    expect(cushionMonths(9_400_000, 0)).toBeNull();
  });
});

describe('projectedSavingsRate', () => {
  it('keeps what is left after spending and the committed costs', () => {
    expect(projectedSavingsRate(overview())).toBeCloseTo(0.458, 3);
  });

  it('is null without income', () => {
    expect(projectedSavingsRate(overview({ income: 0 }))).toBeNull();
  });
});

describe('groupByDay', () => {
  it('groups consecutive movements of the same day and names today and yesterday', () => {
    const groups = groupByDay(
      [movement(1, '2026-10-20'), movement(2, '2026-10-20'), movement(3, '2026-10-19'), movement(4, '2026-10-17')],
      '2026-10-20',
    );

    expect(groups.map((group) => group.date)).toEqual(['2026-10-20', '2026-10-19', '2026-10-17']);
    expect(groups.map((group) => group.relative)).toEqual(['today', 'yesterday', null]);
    expect(groups.map((group) => group.movements.map((item) => item.id))).toEqual([[1, 2], [3], [4]]);
  });

  it('keeps the order it receives instead of sorting by date', () => {
    const groups = groupByDay([movement(1, '2026-10-17'), movement(2, '2026-10-20'), movement(3, '2026-10-20')], '2026-10-20');

    expect(groups.map((group) => group.date)).toEqual(['2026-10-17', '2026-10-20']);
    expect(groups[1].movements.map((item) => item.id)).toEqual([2, 3]);
  });

  it('groups by the Colombian day, not by the UTC date of the instant', () => {
    // 02:00 UTC del 21 son las 21:00 del 20 en Colombia.
    const late = { ...movement(1, '2026-10-20'), date: '2026-10-21T02:00:00Z' };
    const groups = groupByDay([late, movement(2, '2026-10-20')], '2026-10-21');

    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-10-20');
    expect(groups[0].relative).toBe('yesterday');
  });

  it('recognises yesterday across a month boundary', () => {
    const groups = groupByDay([movement(1, '2026-09-30')], '2026-10-01');

    expect(groups[0].relative).toBe('yesterday');
  });

  it('returns no groups without movements', () => {
    expect(groupByDay([], '2026-10-20')).toEqual([]);
  });
});
