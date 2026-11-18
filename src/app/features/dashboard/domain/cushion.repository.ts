import { Observable } from 'rxjs';
import { Cushion, CushionCandidate } from './cushion';

/** Puerto: de dónde sale «Tu colchón» y cómo se configura. Todo fallo llega como `DashboardError`. */
export abstract class CushionRepository {
  /** El colchón del usuario por moneda, con su meta. */
  abstract cushion(): Observable<Cushion>;

  /** Las cuentas que se pueden elegir para el colchón, con su marca actual. */
  abstract candidates(): Observable<CushionCandidate[]>;

  /** Deja marcadas exactamente estas cuentas; las demás activas quedan sin marca. */
  abstract saveAccounts(accountIds: readonly number[]): Observable<void>;

  /** Guarda la meta en meses (1 a 24). */
  abstract saveGoal(months: number): Observable<void>;
}
