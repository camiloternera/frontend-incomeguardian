import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Transaction } from '../domain/transaction';

/** Confirmación que muestra el listado tras registrar, editar o eliminar un movimiento. */
export type WorkspaceNotice =
  | { kind: 'created'; transaction: Transaction }
  | { kind: 'updated' }
  | { kind: 'removed' };

/**
 * Estado que comparten el listado y los paneles laterales mientras conviven en pantalla.
 * Lo provee la página del listado: el panel o el detalle avisan del cambio y la lista se recarga.
 */
@Injectable()
export class TransactionWorkspace {
  private readonly changedSubject = new Subject<void>();

  /** Último cambio, para confirmarlo en el listado. */
  readonly notice = signal<WorkspaceNotice | null>(null);

  /** Emite cada vez que se registra, edita o elimina un movimiento. */
  readonly changed$: Observable<void> = this.changedSubject.asObservable();

  /** Confirma el movimiento recién registrado y pide al listado que se actualice. */
  saved(transaction: Transaction): void {
    this.notify({ kind: 'created', transaction });
  }

  /** Confirma la edición de un movimiento y pide al listado que se actualice. */
  updated(): void {
    this.notify({ kind: 'updated' });
  }

  /** Confirma la eliminación de un movimiento y pide al listado que se actualice. */
  removed(): void {
    this.notify({ kind: 'removed' });
  }

  /** Pide al listado que se actualice sin confirmar nada (por ejemplo, tras un mes cerrado en otro dispositivo). */
  refresh(): void {
    this.changedSubject.next();
  }

  private notify(notice: WorkspaceNotice): void {
    this.notice.set(notice);
    this.changedSubject.next();
  }
}
