import { STATEMENT_STATUSES, canPayStatement, isStatementStatus } from './card-statement';

describe('card statement', () => {
  it('recognizes every known status, upcoming included', () => {
    expect(STATEMENT_STATUSES.every((status) => isStatementStatus(status))).toBe(true);
    expect(isStatementStatus('upcoming')).toBe(true);
    expect(isStatementStatus('frozen')).toBe(false);
    expect(isStatementStatus(null)).toBe(false);
  });

  it.each(['open', 'due', 'partial', 'overdue'] as const)('can pay a %s statement with a balance due', (status) => {
    expect(canPayStatement({ status, balanceDue: 1000 })).toBe(true);
  });

  it('cannot pay a statement with nothing due', () => {
    expect(canPayStatement({ status: 'paid', balanceDue: 0 })).toBe(false);
    expect(canPayStatement({ status: 'due', balanceDue: 0 })).toBe(false);
  });

  it('cannot pay an upcoming statement even with installments scheduled', () => {
    expect(canPayStatement({ status: 'upcoming', balanceDue: 101500 })).toBe(false);
  });
});
