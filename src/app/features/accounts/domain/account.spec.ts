import { Account, cardDebt, creditUsage, positionsByCurrency, totalsByCurrency } from './account';

function account(
  id: number,
  currency: Account['currency'],
  initialBalance: number,
  isActive = true,
  overrides: Partial<Account> = {},
): Account {
  return {
    id,
    name: `Cuenta ${id}`,
    kind: 'standard',
    initialBalance,
    currentBalance: initialBalance,
    currency,
    isActive,
    hasTransactions: false,
    openingDate: '2026-10-01T00:00:00Z',
    creditLimit: null,
    statementDay: null,
    paymentDay: null,
    availableCredit: null,
    nextStatementDate: null,
    nextPaymentDueDate: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: null,
    ...overrides,
  };
}

/** Tarjeta con ese saldo (negativo = deuda). */
function card(id: number, currency: Account['currency'], balance: number, overrides: Partial<Account> = {}): Account {
  return account(id, currency, balance, true, { kind: 'credit_card', statementDay: 15, paymentDay: 5, ...overrides });
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

describe('positionsByCurrency', () => {
  it('separates what is in the accounts from the card debt, per currency', () => {
    const positions = positionsByCurrency([
      account(1, 'COP', 4_000_000),
      account(2, 'COP', -100_000),
      card(3, 'COP', -1_500_000),
      card(4, 'USD', -200),
      account(5, 'USD', 800),
    ]);

    expect(positions).toEqual([
      // Una cuenta normal en negativo resta de lo que se tiene; no es deuda de tarjeta.
      { currency: 'COP', assets: 3_900_000, debt: 1_500_000, net: 2_400_000 },
      { currency: 'USD', assets: 800, debt: 200, net: 600 },
    ]);
  });

  it('adds a positive card balance to the assets', () => {
    expect(positionsByCurrency([account(1, 'COP', 1000), card(2, 'COP', 250)])).toEqual([
      { currency: 'COP', assets: 1250, debt: 0, net: 1250 },
    ]);
  });

  it('ignores inactive accounts and cards', () => {
    expect(positionsByCurrency([account(1, 'COP', 1000), card(2, 'COP', -500, { isActive: false })])).toEqual([
      { currency: 'COP', assets: 1000, debt: 0, net: 1000 },
    ]);
    expect(positionsByCurrency([card(2, 'COP', -500, { isActive: false })])).toEqual([]);
  });

  it('keeps the decimals exact', () => {
    const [position] = positionsByCurrency([account(1, 'USD', 0.3), card(2, 'USD', -0.1), card(3, 'USD', -0.2)]);

    expect(position).toEqual({ currency: 'USD', assets: 0.3, debt: 0.3, net: 0 });
  });
});

describe('cardDebt', () => {
  it('returns the debt in positive', () => {
    expect(cardDebt({ currentBalance: -350_000 })).toBe(350_000);
  });

  it('returns 0 with a zero or positive balance', () => {
    expect(cardDebt({ currentBalance: 0 })).toBe(0);
    expect(cardDebt({ currentBalance: 1200 })).toBe(0);
  });
});

describe('creditUsage', () => {
  it('returns the used share of the limit', () => {
    expect(creditUsage({ creditLimit: 2_000_000, currentBalance: -500_000 })).toBe(0.25);
  });

  it('caps at 1 when the card is over its limit', () => {
    expect(creditUsage({ creditLimit: 1_000_000, currentBalance: -1_300_000 })).toBe(1);
  });

  it('returns 0 with a balance in favor', () => {
    expect(creditUsage({ creditLimit: 1_000_000, currentBalance: 5000 })).toBe(0);
  });

  it('returns null without a limit', () => {
    expect(creditUsage({ creditLimit: null, currentBalance: -500 })).toBeNull();
    expect(creditUsage({ creditLimit: 0, currentBalance: -500 })).toBeNull();
  });
});
