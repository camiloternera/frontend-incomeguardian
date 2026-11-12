import { Observable } from 'rxjs';
import { RecentMovement } from './recent-movement';

/** Puerto: de dónde salen los últimos movimientos del Resumen. Todo fallo llega como `DashboardError`. */
export abstract class RecentMovementsRepository {
  /** Los últimos `limit` movimientos del usuario, del más reciente al más antiguo. */
  abstract recent(limit: number): Observable<RecentMovement[]>;
}
