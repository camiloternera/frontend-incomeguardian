import { Observable } from 'rxjs';
import { DashboardOverview } from './dashboard-overview';

/** Port: where the overview comes from. Implemented in infrastructure. */
export abstract class DashboardRepository {
  abstract overview(): Observable<DashboardOverview>;
}
