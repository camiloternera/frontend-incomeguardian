import { Observable } from 'rxjs';
import { BudgetCategoryOption, BudgetCurrency, BudgetKey, BudgetMonth, BudgetSummary } from './budget';

/** Tope de una categoría en una moneda que admite topes. */
export interface BudgetTarget extends BudgetKey {
  currency: BudgetCurrency;
}

/**
 * Puerto: cómo llega el dominio de presupuestos al backend. Se implementa en infrastructure.
 * Todo fallo llega como `BudgetError`.
 */
export abstract class BudgetRepository {
  /** Topes, gasto y disponible de cada categoría en el mes, con los totales por moneda. */
  abstract summary(month: BudgetMonth): Observable<BudgetSummary>;

  /** Fija el tope que se repite cada mes desde `from` en adelante. */
  abstract saveRecurring(target: BudgetTarget, amount: number, from: BudgetMonth): Observable<void>;

  /** «Quitar tope»: deja la categoría sin tope desde `from`, incluidos los topes propios de esos meses. */
  abstract removeRecurring(key: BudgetKey, from: BudgetMonth): Observable<void>;

  /** «Solo este mes»: un tope propio del mes; 0 pausa la categoría ese mes. */
  abstract saveMonth(month: BudgetMonth, target: BudgetTarget, amount: number): Observable<void>;

  /** «Volver al tope recurrente»: borra el tope propio del mes. */
  abstract removeMonth(month: BudgetMonth, key: BudgetKey): Observable<void>;
}

/**
 * Puerto: las categorías del usuario, para nombrar el tipo, detectar las desactivadas y elegir una
 * al crear un tope. Vive en este dominio porque un dominio no importa de otro.
 */
export abstract class BudgetCategoryOptionsRepository {
  abstract list(): Observable<BudgetCategoryOption[]>;
}
