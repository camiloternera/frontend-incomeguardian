import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DashboardOverview } from '../domain/dashboard-overview';
import { DashboardRepository } from '../domain/dashboard.repository';

/**
 * Datos de ejemplo del colchón mientras el backend no los expone. Cambiarlo
 * por un adaptador HTTP es una línea en `dashboard.providers.ts`; ni application
 * ni presentation notan la diferencia.
 */
const OVERVIEW: DashboardOverview = {
  month: '2026-10',
  asOf: '2026-10-20',
  currency: 'COP',
  income: 6_200_000,
  incomePayments: 3,
  expenses: 2_360_000,
  committed: 1_000_000,
  savings: 9_400_000,
  goals: { savingsRate: 0.3, cushionMonths: 6 },
  cashFlow: [
    { month: '2026-05', income: 4_100_000, expenses: 3_700_000 },
    { month: '2026-06', income: 6_800_000, expenses: 4_200_000 },
    { month: '2026-07', income: 3_200_000, expenses: 3_900_000 },
    { month: '2026-08', income: 5_900_000, expenses: 3_600_000 },
    { month: '2026-09', income: 6_200_000, expenses: 4_000_000 },
    { month: '2026-10', income: 6_200_000, expenses: 2_360_000 },
  ],
  categories: [
    { key: 'housing', amount: 1_150_000, share: 0.49 },
    { key: 'food', amount: 520_000, share: 0.22 },
    { key: 'transport', amount: 240_000, share: 0.1 },
    { key: 'subscriptions', amount: 180_000, share: 0.08 },
    { key: 'health', amount: 150_000, share: 0.06 },
    { key: 'other', amount: 120_000, share: 0.05 },
  ],
};

@Injectable()
export class InMemoryDashboardRepository extends DashboardRepository {
  overview(): Observable<DashboardOverview> {
    return of(OVERVIEW);
  }
}
