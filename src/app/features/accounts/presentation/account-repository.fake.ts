import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { provideAccounts } from '../accounts.providers';
import { Account, AccountDraft, AccountTypeOption } from '../domain/account';
import { AccountError, AccountErrorCode } from '../domain/account-error';
import { AccountRepository, AccountTypeOptionsRepository } from '../domain/account.repository';

/** Repositorio en memoria para los tests de presentation; `failWith` fuerza el siguiente error. */
export class FakeAccountRepository extends AccountRepository {
  accounts: Account[] = [
    {
      id: 5,
      name: 'Visa 4417',
      accountType: { id: 3, name: 'Tarjeta de crédito' },
      initialBalance: -250000,
      currency: 'COP',
      isActive: true,
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: null,
    },
    {
      id: 2,
      name: 'Bancolombia',
      accountType: { id: 1, name: 'Ahorros' },
      initialBalance: 1250000,
      currency: 'COP',
      isActive: true,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: null,
    },
    {
      id: 8,
      name: 'Wise',
      accountType: { id: 1, name: 'Ahorros' },
      initialBalance: 320.5,
      currency: 'USD',
      isActive: false,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    },
  ];
  failWith: AccountError | null = null;
  lastDraft: AccountDraft | null = null;

  list(): Observable<Account[]> {
    return this.respond(() => [...this.accounts]);
  }

  get(id: number): Observable<Account> {
    return this.respond(() => this.find(id));
  }

  create(draft: AccountDraft): Observable<Account> {
    this.lastDraft = draft;
    return this.respond(() => this.fromDraft(99, draft, { isActive: true, createdAt: '2026-10-31T00:00:00Z', updatedAt: null }));
  }

  update(id: number, draft: AccountDraft): Observable<Account> {
    this.lastDraft = draft;
    return this.respond(() => this.fromDraft(id, draft, this.find(id)));
  }

  deactivate(id: number): Observable<void> {
    return this.respond(() => {
      this.accounts = this.accounts.map((account) => (account.id === id ? { ...account, isActive: false } : account));
    });
  }

  private fromDraft(id: number, draft: AccountDraft, rest: Pick<Account, 'isActive' | 'createdAt' | 'updatedAt'>): Account {
    const { accountTypeId, ...fields } = draft;

    return { id, ...fields, accountType: { id: accountTypeId, name: `Tipo ${accountTypeId}` }, ...rest };
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

/** Tipos de cuenta en memoria para el selector del formulario. */
export class FakeAccountTypeOptionsRepository extends AccountTypeOptionsRepository {
  options: AccountTypeOption[] = [
    { id: 3, name: 'Tarjeta de crédito' },
    { id: 1, name: 'Ahorros' },
  ];

  list(): Observable<AccountTypeOption[]> {
    return of([...this.options]);
  }
}

/** Los proveedores reales del dominio, con los repositorios HTTP sustituidos por los falsos. */
export function provideFakeAccounts(
  fake: FakeAccountRepository,
  options = new FakeAccountTypeOptionsRepository(),
): Provider[] {
  return [
    ...provideAccounts(),
    { provide: AccountRepository, useValue: fake },
    { provide: AccountTypeOptionsRepository, useValue: options },
  ];
}
