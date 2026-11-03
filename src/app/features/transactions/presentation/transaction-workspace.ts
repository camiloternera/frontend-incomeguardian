import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Transaction } from '../domain/transaction';

/**
 * Estado que comparten el listado y el panel lateral mientras conviven en pantalla.
 * Lo provee la página del listado: el panel avisa del movimiento registrado y la lista se recarga.
 */
@Injectable()
export class TransactionWorkspace {
  private readonly savedSubject = new Subject<Transaction>();

  /** Último movimiento registrado, para confirmarlo en el listado. */
  readonly notice = signal<Transaction | null>(null);

  /** Emite cada movimiento registrado desde el panel. */
  readonly saved$: Observable<Transaction> = this.savedSubject.asObservable();

  /** Confirma el movimiento recién registrado y pide al listado que se actualice. */
  saved(transaction: Transaction): void {
    this.notice.set(transaction);
    this.savedSubject.next(transaction);
  }
}
