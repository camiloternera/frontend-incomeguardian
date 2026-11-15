import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { PeriodRef } from '../domain/period';

/** Cambio de estado de un período, con el workspace que lo hizo. */
export interface PeriodSyncEvent {
  source: object;
  period: PeriodRef;
}

/**
 * Bus global del cierre de períodos. Cada vista (Resumen, Movimientos, Presupuesto, Ajustes) tiene
 * su propio `PeriodWorkspace` y su propia caché, que vive mientras dure la app. Cuando una vista
 * cierra o reabre un período, avisa por aquí para que las demás recarguen sus datos.
 */
@Injectable({ providedIn: 'root' })
export class PeriodSync {
  private readonly events = new Subject<PeriodSyncEvent>();

  readonly changed$: Observable<PeriodSyncEvent> = this.events.asObservable();

  publish(event: PeriodSyncEvent): void {
    this.events.next(event);
  }
}
