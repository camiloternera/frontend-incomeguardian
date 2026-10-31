import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AccountType, AccountTypeDraft, sortAccountTypes } from '../domain/account-type';
import { AccountTypeRepository } from '../domain/account-type.repository';

function trimmed(draft: AccountTypeDraft): AccountTypeDraft {
  return { name: draft.name.trim(), description: draft.description.trim() };
}

@Injectable()
export class ListAccountTypesUseCase {
  private readonly repository = inject(AccountTypeRepository);

  execute(): Observable<AccountType[]> {
    return this.repository.list().pipe(map(sortAccountTypes));
  }
}

@Injectable()
export class GetAccountTypeUseCase {
  private readonly repository = inject(AccountTypeRepository);

  execute(id: number): Observable<AccountType> {
    return this.repository.get(id);
  }
}

@Injectable()
export class CreateAccountTypeUseCase {
  private readonly repository = inject(AccountTypeRepository);

  execute(draft: AccountTypeDraft): Observable<AccountType> {
    return this.repository.create(trimmed(draft));
  }
}

@Injectable()
export class UpdateAccountTypeUseCase {
  private readonly repository = inject(AccountTypeRepository);

  execute(id: number, draft: AccountTypeDraft): Observable<AccountType> {
    return this.repository.update(id, trimmed(draft));
  }
}

@Injectable()
export class DeactivateAccountTypeUseCase {
  private readonly repository = inject(AccountTypeRepository);

  execute(id: number): Observable<void> {
    return this.repository.deactivate(id);
  }
}
