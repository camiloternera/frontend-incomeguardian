import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DeactivateAccountTypeUseCase } from '../application/account-type-use-cases';
import { AccountType, sortAccountTypes } from '../domain/account-type';
import { AccountTypeError, AccountTypeErrorCode } from '../domain/account-type-error';

/** Acción completada que la vista confirma al usuario. */
export interface AccountTypeNotice {
  kind: 'created' | 'updated' | 'deactivated';
  name: string;
}

/**
 * Estado que comparten el listado y el panel lateral mientras conviven en pantalla.
 * Lo provee la página del listado, así el panel actualiza la lista sin volver a pedirla al backend.
 */
@Injectable()
export class AccountTypeWorkspace {
  private readonly deactivateAccountType = inject(DeactivateAccountTypeUseCase);

  /** `null` mientras se cargan los tipos de cuenta por primera vez. */
  readonly accountTypes = signal<AccountType[] | null>(null);
  /** Aviso de la última acción completada. */
  readonly notice = signal<AccountTypeNotice | null>(null);
  /** Tipo de cuenta abierto en el panel, para resaltarla en la lista. */
  readonly selectedId = signal<number | null>(null);

  /** Incorpora a la lista un tipo de cuenta recién creado o editado y avisa del cambio. */
  saved(accountType: AccountType, kind: 'created' | 'updated'): void {
    this.accountTypes.update((accountTypes) =>
      accountTypes === null ? null : sortAccountTypes([...accountTypes.filter((item) => item.id !== accountType.id), accountType]),
    );
    this.notice.set({ kind, name: accountType.name });
  }

  /**
   * Desactiva el tipo de cuenta y lo retira de la lista. Si el backend ya no lo tiene, también se retira,
   * pero el error sigue su curso para que la vista lo cuente.
   */
  deactivate(accountType: AccountType): Observable<void> {
    return this.deactivateAccountType.execute(accountType.id).pipe(
      tap({
        next: () => {
          this.drop(accountType.id);
          this.notice.set({ kind: 'deactivated', name: accountType.name });
        },
        error: (error: unknown) => {
          if (error instanceof AccountTypeError && error.code === AccountTypeErrorCode.NotFound) {
            this.drop(accountType.id);
          }
        },
      }),
    );
  }

  private drop(id: number): void {
    this.accountTypes.update((accountTypes) => accountTypes?.filter((accountType) => accountType.id !== id) ?? null);
  }
}
