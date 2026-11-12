import { Provider } from '@angular/core';
import { GetMonthSummaryUseCase } from './application/get-month-summary.use-case';
import { GetOverviewUseCase } from './application/get-overview.use-case';
import { GetRecentMovementsUseCase } from './application/get-recent-movements.use-case';
import { DashboardRepository } from './domain/dashboard.repository';
import { MonthSummaryRepository } from './domain/month-summary.repository';
import { RecentMovementsRepository } from './domain/recent-movements.repository';
import { InMemoryDashboardRepository } from './infrastructure/in-memory-dashboard.repository';
import { MonthSummaryHttpRepository } from './infrastructure/month-summary-http.repository';
import { RecentMovementsHttpRepository } from './infrastructure/recent-movements-http.repository';

/**
 * Binds the dashboard ports to their adapters. Registered in `dashboard.routes.ts`
 * rather than `app.config.ts` so the adapter stays inside the lazy chunk — which
 * is also why the use cases are listed here instead of `providedIn: 'root'`: a
 * root-provided use case cannot see a port bound in the lazy route injector.
 *
 * El bloque principal y los movimientos recientes ya leen del backend; el
 * colchón sigue con los datos de ejemplo en memoria.
 */
export function provideDashboard(): Provider[] {
  return [
    { provide: DashboardRepository, useClass: InMemoryDashboardRepository },
    { provide: MonthSummaryRepository, useClass: MonthSummaryHttpRepository },
    { provide: RecentMovementsRepository, useClass: RecentMovementsHttpRepository },
    GetOverviewUseCase,
    GetMonthSummaryUseCase,
    GetRecentMovementsUseCase,
  ];
}
