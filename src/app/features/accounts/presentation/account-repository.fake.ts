import { Routes } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { accountsRoutes } from '../accounts.routes';
import { Account, AccountDraft } from '../domain/account';
import { AccountError, AccountErrorCode } from '../domain/account-error';
import { AccountRepository } from '../domain/account.repository';
import { CardStatement } from '../domain/card-statement';
import { CardMonth } from '../domain/credit-card-calendar';

/** Repositorio en memoria para los tests de presentation; `failWith` fuerza el siguiente error. */
export class FakeAccountRepository extends AccountRepository {
  accounts: Account[] = [
    {
      id: 5,
      name: 'Visa 4417',
      // Cuenta normal con saldo negativo, como antes de las tarjetas; los tests de tarjetas agregan las suyas.
      kind: 'standard',
      creditLimit: null,
      statementDay: null,
      paymentDay: null,
      availableCredit: null,
      nextStatementDate: null,
      nextPaymentDueDate: null,
      initialBalance: -250000,
      currentBalance: -250000,
      currency: 'COP',
      isActive: true,
      hasTransactions: true,
      openingDate: '2026-10-20T00:00:00Z',
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: null,
    },
    {
      id: 2,
      name: 'Bancolombia',
      kind: 'standard',
      creditLimit: null,
      statementDay: null,
      paymentDay: null,
      availableCredit: null,
      nextStatementDate: null,
      nextPaymentDueDate: null,
      initialBalance: 1250000,
      currentBalance: 1250000,
      currency: 'COP',
      isActive: true,
      hasTransactions: false,
      openingDate: '2026-10-01T00:00:00Z',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: null,
    },
    {
      id: 8,
      name: 'Wise',
      kind: 'standard',
      creditLimit: null,
      statementDay: null,
      paymentDay: null,
      availableCredit: null,
      nextStatementDate: null,
      nextPaymentDueDate: null,
      initialBalance: 320.5,
      currentBalance: 320.5,
      currency: 'USD',
      isActive: false,
      hasTransactions: false,
      openingDate: '2026-09-01T00:00:00Z',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    },
  ];
  /** Extracto que devuelve `statement`, con el mes pedido. */
  statementResult: CardStatement = {
    accountId: 5,
    month: { year: 2026, month: 11 },
    statementDay: 15,
    periodStart: '2026-10-16',
    periodEnd: '2026-11-15',
    paymentDueDate: '2026-12-02',
    total: 250000,
    paymentsTotal: 0,
    balanceDue: 250000,
    status: 'open',
    openingDebt: 250000,
    items: [],
    payments: [],
    previous: null,
    next: null,
  };
  failWith: AccountError | null = null;
  lastDraft: AccountDraft | null = null;
  lastStatementMonth: CardMonth | undefined = undefined;

  list(): Observable<Account[]> {
    return this.respond(() => [...this.accounts]);
  }

  get(id: number): Observable<Account> {
    return this.respond(() => this.find(id));
  }

  create(draft: AccountDraft): Observable<Account> {
    this.lastDraft = draft;
    return this.respond(() =>
      this.fromDraft(99, draft, {
        isActive: true,
        hasTransactions: false,
        createdAt: '2026-10-31T00:00:00Z',
        updatedAt: null,
      }),
    );
  }

  update(id: number, draft: AccountDraft): Observable<Account> {
    this.lastDraft = draft;
    return this.respond(() => this.fromDraft(id, draft, this.find(id)));
  }

  deactivate(id: number): Observable<void> {
    return this.respond(() => {
      this.accounts = this.accounts.map((account) =>
        account.id === id ? { ...account, isActive: false } : account,
      );
    });
  }

  statement(id: number, month?: CardMonth): Observable<CardStatement> {
    this.lastStatementMonth = month;
    return this.respond(() => ({ ...this.statementResult, accountId: id, month: month ?? this.statementResult.month }));
  }

  private fromDraft(
    id: number,
    draft: AccountDraft,
    rest: Pick<Account, 'isActive' | 'hasTransactions' | 'createdAt' | 'updatedAt'>,
  ): Account {
    return {
      id,
      ...draft,
      currentBalance: draft.initialBalance,
      availableCredit: draft.creditLimit === null ? null : draft.creditLimit + draft.initialBalance,
      nextStatementDate: null,
      nextPaymentDueDate: null,
      ...rest,
    };
  }

  private find(id: number): Account {
    const account = this.accounts.find((item) => item.id === id);

    if (!account) {
      throw new AccountError('Not found', AccountErrorCode.NotFound);
    }

    return account;
  }

  private respond<T>(value: () => T): Observable<T> {
    const error = this.failWith;
    this.failWith = null;

    if (error) {
      return throwError(() => error);
    }

    try {
      return of(value());
    } catch (thrown) {
      return throwError(() => thrown);
    }
  }
}

/** Las rutas reales del dominio montadas en `/accounts`, con el repositorio falso en lugar del HTTP. */
export function fakeAccountsRoutes(fake: FakeAccountRepository): Routes {
  const [root] = accountsRoutes;

  return [
    {
      path: 'accounts',
      children: [
        {
          ...root,
          providers: [
            ...(root.providers ?? []),
            { provide: AccountRepository, useValue: fake },
          ],
        },
      ],
    },
  ];
}
