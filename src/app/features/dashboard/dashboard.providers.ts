import { Provider } from '@angular/core';
import { GetOverviewUseCase } from './application/get-overview.use-case';
import { DashboardRepository } from './domain/dashboard.repository';
import { InMemoryDashboardRepository } from './infrastructure/in-memory-dashboard.repository';

/**
 * Binds the dashboard ports to their adapters. Registered in `dashboard.routes.ts`
 * rather than `app.config.ts` so the adapter stays inside the lazy chunk — which
 * is also why the use cases are listed here instead of `providedIn: 'root'`: a
 * root-provided use case cannot see a port bound in the lazy route injector.
 */
export function provideDashboard(): Provider[] {
  return [
    { provide: DashboardRepository, useClass: InMemoryDashboardRepository },
    GetOverviewUseCase,
  ];
}
