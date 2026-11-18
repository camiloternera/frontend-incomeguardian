import { Provider } from '@angular/core';
import { GetMonthSummaryUseCase } from './application/get-month-summary.use-case';
import { GetCushionCandidatesUseCase, GetCushionUseCase, SaveCushionUseCase } from './application/cushion-use-cases';
import { GetRecentMovementsUseCase } from './application/get-recent-movements.use-case';
import { CushionRepository } from './domain/cushion.repository';
import { MonthSummaryRepository } from './domain/month-summary.repository';
import { RecentMovementsRepository } from './domain/recent-movements.repository';
import { CushionHttpRepository } from './infrastructure/cushion-http.repository';
import { MonthSummaryHttpRepository } from './infrastructure/month-summary-http.repository';
import { RecentMovementsHttpRepository } from './infrastructure/recent-movements-http.repository';

/**
 * Binds the dashboard ports to their adapters. Registered in `dashboard.routes.ts`
 * rather than `app.config.ts` so the adapter stays inside the lazy chunk — which
 * is also why the use cases are listed here instead of `providedIn: 'root'`: a
 * root-provided use case cannot see a port bound in the lazy route injector.
 *
 * El bloque principal, los movimientos recientes y el colchón leen del backend.
 */
export function provideDashboard(): Provider[] {
  return [
    { provide: CushionRepository, useClass: CushionHttpRepository },
    { provide: MonthSummaryRepository, useClass: MonthSummaryHttpRepository },
    { provide: RecentMovementsRepository, useClass: RecentMovementsHttpRepository },
    GetCushionUseCase,
    GetCushionCandidatesUseCase,
    SaveCushionUseCase,
    GetMonthSummaryUseCase,
    GetRecentMovementsUseCase,
  ];
}
