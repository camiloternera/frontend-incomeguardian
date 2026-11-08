import { Observable } from 'rxjs';
import {
  ExchangeRate,
  Transaction,
  TransactionAccountOption,
  TransactionCategoryOption,
  TransactionDraft,
  TransactionPage,
  TransactionQuery,
  TransactionType,
} from './transaction';

/**
 * Puerto: cómo llega el dominio de movimientos al backend. Se implementa en infrastructure.
 * Todo fallo llega como `TransactionError`.
 */
export abstract class TransactionRepository {
  /** Movimientos activos del usuario, del más reciente al más antiguo. */
  abstract list(query: TransactionQuery): Observable<TransactionPage>;

  /** Registra un movimiento; en transferencias entre monedas el backend calcula el monto destino. */
  abstract create(draft: TransactionDraft): Observable<Transaction>;
}

/**
 * Puerto: las cuentas del usuario que se pueden elegir en un movimiento. Vive en este dominio
 * porque un dominio no importa de otro; su adaptador consulta el mismo backend que `accounts`.
 */
export abstract class TransactionAccountOptionsRepository {
  abstract list(): Observable<TransactionAccountOption[]>;
}

/** Puerto: las categorías del usuario, filtradas por tipo de movimiento si se indica. */
export abstract class TransactionCategoryOptionsRepository {
  abstract list(type?: TransactionType): Observable<TransactionCategoryOption[]>;
}

/** Puerto: la TRM vigente para una fecha `YYYY-MM-DD` (hoy en Colombia si se omite). */
export abstract class ExchangeRateRepository {
  abstract trm(date?: string): Observable<ExchangeRate>;
}
