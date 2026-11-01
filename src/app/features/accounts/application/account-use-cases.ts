import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Account, AccountDraft, AccountTypeOption, sortAccounts } from '../domain/account';
import { AccountRepository, AccountTypeOptionsRepository } from '../domain/account.repository';

function trimmed(draft: AccountDraft): AccountDraft {
  return { ...draft, name: draft.name.trim() };
}

@Injectable()
export class ListAccountsUseCase {
  private readonly repository = inject(AccountRepository);

  execute(): Observable<Account[]> {
    return this.repository.list().pipe(map(sortAccounts));
  }
}

@Injectable()
export class GetAccountUseCase {
  private readonly repository = inject(AccountRepository);

  execute(id: number): Observable<Account> {
    return this.repository.get(id);
  }
}

@Injectable()
export class CreateAccountUseCase {
  private readonly repository = inject(AccountRepository);

  execute(draft: AccountDraft): Observable<Account> {
    return this.repository.create(trimmed(draft));
  }
}

@Injectable()
export class UpdateAccountUseCase {
  private readonly repository = inject(AccountRepository);

  execute(id: number, draft: AccountDraft): Observable<Account> {
    return this.repository.update(id, trimmed(draft));
  }
}

@Injectable()
export class DeactivateAccountUseCase {
  private readonly repository = inject(AccountRepository);

  execute(id: number): Observable<void> {
    return this.repository.deactivate(id);
  }
}

@Injectable()
export class ListAccountTypeOptionsUseCase {
  private readonly repository = inject(AccountTypeOptionsRepository);

  /** Tipos activos ordenados por nombre, para el selector del formulario. */
  execute(): Observable<AccountTypeOption[]> {
    return this.repository
      .list()
      .pipe(map((options) => [...options].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))));
  }
}
