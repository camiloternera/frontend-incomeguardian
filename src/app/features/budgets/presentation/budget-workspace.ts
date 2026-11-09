import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BudgetCategoryOption, BudgetMonth, BudgetSummary } from '../domain/budget';

/** Acción completada que la vista confirma al usuario. */
export interface BudgetNotice {
  kind: 'saved' | 'removed' | 'reset';
  name: string;
}

/**
 * Estado que comparten el listado y el panel lateral mientras conviven en pantalla. Lo provee la
 * página: el panel lee el resumen del mes y avisa los cambios para que la página lo vuelva a pedir.
 */
@Injectable()
export class BudgetWorkspace {
  private readonly changes = new Subject<void>();

  /** Mes visible. */
  readonly month = signal<BudgetMonth>({ year: 1970, month: 1 });
  /** Resumen del mes visible; `null` mientras se pide. */
  readonly summary = signal<BudgetSummary | null>(null);
  /** Categorías del usuario, activas y desactivadas; vacía si no se pudieron leer. */
  readonly categories = signal<BudgetCategoryOption[]>([]);
  /** Fila abierta en el panel (`categoría-moneda`), para resaltarla. */
  readonly selectedKey = signal<string | null>(null);
  /** Aviso de la última acción completada. */
  readonly notice = signal<BudgetNotice | null>(null);

  /** Emite cuando un tope cambió y el resumen debe volver a pedirse. */
  readonly changed$: Observable<void> = this.changes.asObservable();

  /** Confirma la acción y pide recargar el resumen. */
  done(notice: BudgetNotice): void {
    this.notice.set(notice);
    this.changes.next();
  }

  /** Pide recargar el resumen sin aviso (por ejemplo, tras un PERIOD_CLOSED). */
  refresh(): void {
    this.changes.next();
  }
}

/** Clave estable de una fila del resumen. */
export function rowKey(categoryId: number, currency: string): string {
  return `${categoryId}-${currency}`;
}
