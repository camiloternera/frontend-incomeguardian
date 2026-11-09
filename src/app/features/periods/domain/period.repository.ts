import { Observable } from 'rxjs';
import {
  PendingPeriod,
  PeriodClosingSettings,
  PeriodLog,
  PeriodMonth,
  PeriodRef,
  PeriodReview,
  PeriodYear,
  ReopenRequest,
} from './period';

/**
 * Puerto: cómo llega el dominio de cierre de períodos al backend. Se implementa en infrastructure.
 * Todo fallo llega como `PeriodError`.
 */
export abstract class PeriodRepository {
  /** Estado del año y de sus 12 meses. */
  abstract year(year: number): Observable<PeriodYear>;

  /** El mes pendiente más antiguo que el Resumen debe recordar, o null. */
  abstract pending(): Observable<PendingPeriod | null>;

  /** Totales, saldos y checks para revisar un mes o un año antes de cerrarlo. */
  abstract review(period: PeriodRef): Observable<PeriodReview>;

  /** Cierra un mes. */
  abstract closeMonth(year: number, month: number): Observable<PeriodMonth>;

  /** Reabre un mes cerrado. */
  abstract reopenMonth(year: number, month: number, request: ReopenRequest): Observable<PeriodMonth>;

  /** Cierra los meses abiertos que falten y luego el año. */
  abstract closeYear(year: number): Observable<PeriodYear>;

  /** Reabre el año; sus meses siguen cerrados. */
  abstract reopenYear(year: number, reason: string | null): Observable<PeriodYear>;

  /** Cierres y reaperturas, del más reciente al más antiguo. */
  abstract history(limit: number): Observable<PeriodLog[]>;

  abstract settings(): Observable<PeriodClosingSettings>;

  abstract saveSettings(settings: PeriodClosingSettings): Observable<PeriodClosingSettings>;
}
