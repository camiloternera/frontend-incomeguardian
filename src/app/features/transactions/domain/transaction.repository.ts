import { Observable } from 'rxjs';
import {
  ExchangeRate,
  InstallmentPreview,
  InstallmentPreviewRequest,
  Transaction,
  TransactionAccountOption,
  TransactionCategoryOption,
  TransactionDraft,
  TransactionPage,
  TransactionQuery,
  TransactionRange,
  TransactionSummary,
  TransactionType,
} from './transaction';

/**
 * Puerto: cómo llega el dominio de movimientos al backend. Se implementa en infrastructure.
 * Todo fallo llega como `TransactionError`.
 */
export abstract class TransactionRepository {
  /** Movimientos activos del usuario, del más reciente al más antiguo. */
  abstract list(query: TransactionQuery): Observable<TransactionPage>;

  /** Lo que entró y salió en el rango, por moneda, y cuántos movimientos hubo. */
  abstract summary(range: TransactionRange): Observable<TransactionSummary>;

  /** Registra un movimiento; en transferencias entre monedas el backend calcula el monto destino. */
  abstract create(draft: TransactionDraft): Observable<Transaction>;

  /** Un movimiento con su plan de cuotas. */
  abstract get(id: number): Observable<Transaction>;

  /** Reemplaza un movimiento con los datos del borrador; valida también el mes de la nueva fecha. */
  abstract update(id: number, draft: TransactionDraft): Observable<Transaction>;

  /** Elimina un movimiento. No se puede deshacer: sale del historial, los saldos, los topes y el Resumen. */
  abstract remove(id: number): Observable<void>;

  /** Calcula el plan de cuotas de una compra con tarjeta sin guardarla. */
  abstract previewInstallments(request: InstallmentPreviewRequest): Observable<InstallmentPreview>;
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
