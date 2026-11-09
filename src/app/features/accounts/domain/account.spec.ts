import { Account, totalsByCurrency } from './account';

function account(
  id: number,
  currency: Account['currency'],
  initialBalance: number,
  isActive = true,
): Account {
  return {
    id,
    name: `Cuenta ${id}`,
    initialBalance,
    currentBalance: initialBalance,
    currency,
    isActive,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: null,
  };
}

describe('totalsByCurrency', () => {
  it('adds the active balances per currency, in the currency order, without mixing them', () => {
    const totals = totalsByCurrency([
      account(1, 'USD', 800),
      account(2, 'COP', 4_000_000),
      account(3, 'COP', -1_082_000),
      account(4, 'COP', 999, false),
    ]);

    expect(totals).toEqual([
      { currency: 'COP', total: 2_918_000, count: 2 },
      { currency: 'USD', total: 800, count: 1 },
    ]);
  });

  it('keeps the decimals exact', () => {
    expect(totalsByCurrency([account(1, 'EUR', 0.1), account(2, 'EUR', 0.2)])[0].total).toBe(0.3);
  });

  it('returns nothing when no account is active', () => {
    expect(totalsByCurrency([account(1, 'COP', 10, false)])).toEqual([]);
  });
});
