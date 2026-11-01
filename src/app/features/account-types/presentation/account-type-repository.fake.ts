import { Routes } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { accountTypesRoutes } from '../account-types.routes';
import { AccountType, AccountTypeDraft } from '../domain/account-type';
import { AccountTypeError, AccountTypeErrorCode } from '../domain/account-type-error';
import { AccountTypeRepository } from '../domain/account-type.repository';

/** Repositorio en memoria para los tests de presentation; `failWith` fuerza el siguiente error. */
export class FakeAccountTypeRepository extends AccountTypeRepository {
  accountTypes: AccountType[] = [
    { id: 3, name: 'Tarjeta de crédito', description: 'Tarjetas con cupo', createdAt: '2026-10-20T00:00:00Z', updatedAt: null },
    { id: 1, name: 'Ahorros', description: 'Cuentas de ahorro del banco', createdAt: '2026-10-01T00:00:00Z', updatedAt: null },
  ];
  failWith: AccountTypeError | null = null;
  lastDraft: AccountTypeDraft | null = null;

  list(): Observable<AccountType[]> {
    return this.respond(() => [...this.accountTypes]);
  }

  get(id: number): Observable<AccountType> {
    return this.respond(() => this.find(id));
  }

  create(draft: AccountTypeDraft): Observable<AccountType> {
    this.lastDraft = draft;
    return this.respond(() => ({ id: 99, ...draft, createdAt: '2026-10-31T00:00:00Z', updatedAt: null }));
  }

  update(id: number, draft: AccountTypeDraft): Observable<AccountType> {
    this.lastDraft = draft;
    return this.respond(() => ({ ...this.find(id), ...draft }));
  }

  deactivate(id: number): Observable<void> {
    return this.respond(() => {
      this.accountTypes = this.accountTypes.filter((accountType) => accountType.id !== id);
    });
  }

  private find(id: number): AccountType {
    const accountType = this.accountTypes.find((item) => item.id === id);

    if (!accountType) {
      throw new AccountTypeError('Not found', AccountTypeErrorCode.NotFound);
    }

    return accountType;
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

/** Las rutas reales del dominio montadas en `/account-types`, con el repositorio falso en lugar del HTTP. */
export function fakeAccountTypesRoutes(fake: FakeAccountTypeRepository): Routes {
  const [root] = accountTypesRoutes;

  return [
    {
      path: 'account-types',
      children: [{ ...root, providers: [...(root.providers ?? []), { provide: AccountTypeRepository, useValue: fake }] }],
    },
  ];
}
