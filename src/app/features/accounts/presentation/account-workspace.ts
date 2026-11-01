import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DeactivateAccountUseCase } from '../application/account-use-cases';
import { Account, sortAccounts } from '../domain/account';
import { AccountError, AccountErrorCode } from '../domain/account-error';

/** Acción completada que la vista confirma al usuario. */
export interface AccountNotice {
  kind: 'created' | 'updated' | 'deactivated';
  name: string;
}

/**
 * Estado que comparten el listado y el panel lateral mientras conviven en pantalla.
 * Lo provee la página del listado, así el panel actualiza la lista sin volver a pedirla al backend.
 */
@Injectable()
export class AccountWorkspace {
  private readonly deactivateAccount = inject(DeactivateAccountUseCase);

  /** `null` mientras se cargan las cuentas por primera vez. */
  readonly accounts = signal<Account[] | null>(null);
  /** Aviso de la última acción completada. */
  readonly notice = signal<AccountNotice | null>(null);
  /** Cuenta abierta en el panel, para resaltarla en la lista. */
  readonly selectedId = signal<number | null>(null);

  /** Incorpora a la lista una cuenta recién creada o editada y avisa del cambio. */
  saved(account: Account, kind: 'created' | 'updated'): void {
    this.accounts.update((accounts) =>
      accounts === null
        ? null
        : sortAccounts([...accounts.filter((item) => item.id !== account.id), account]),
    );
    this.notice.set({ kind, name: account.name });
  }

  /**
   * Desactiva la cuenta, que pasa a la pestaña de desactivadas. Si el backend ya no la tiene, se retira
   * de la lista, pero el error sigue su curso para que la vista lo cuente.
   */
  deactivate(account: Account): Observable<void> {
    return this.deactivateAccount.execute(account.id).pipe(
      tap({
        next: () => {
          this.accounts.update(
            (accounts) =>
              accounts?.map((item) =>
                item.id === account.id ? { ...item, isActive: false } : item,
              ) ?? null,
          );
          this.notice.set({ kind: 'deactivated', name: account.name });
        },
        error: (error: unknown) => {
          if (error instanceof AccountError && error.code === AccountErrorCode.NotFound) {
            this.accounts.update(
              (accounts) => accounts?.filter((item) => item.id !== account.id) ?? null,
            );
          }
        },
      }),
    );
  }
}
