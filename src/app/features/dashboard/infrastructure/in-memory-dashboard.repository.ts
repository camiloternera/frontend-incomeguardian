import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DashboardOverview } from '../domain/dashboard-overview';
import { DashboardRepository } from '../domain/dashboard.repository';

/**
 * Sample data while the backend has no dashboard endpoints. Swapping this for an
 * HTTP adapter is a one-line change in `dashboard.providers.ts`; nothing in
 * application or presentation knows the difference.
 */
const OVERVIEW: DashboardOverview = {
  month: '2026-10',
  currency: 'COP',
  totals: {
    balance: 18420.55,
    income: 4400,
    expenses: 3050.2,
    savingsRate: 0.307,
    balanceChange: 0.062,
    incomeChange: 0.048,
    expensesChange: 0.052,
    savingsRateChange: 0.014,
  },
  cashFlow: [
    { month: '2026-05', income: 4200, expenses: 2800 },
    { month: '2026-06', income: 4200, expenses: 3100 },
    { month: '2026-07', income: 4600, expenses: 2600 },
    { month: '2026-08', income: 4200, expenses: 3400 },
    { month: '2026-09', income: 5100, expenses: 2900 },
    { month: '2026-10', income: 4400, expenses: 3050.2 },
  ],
  categories: [
    { key: 'housing', amount: 1040, share: 0.34 },
    { key: 'food', amount: 672.4, share: 0.22 },
    { key: 'transport', amount: 427, share: 0.14 },
    { key: 'subscriptions', amount: 274.5, share: 0.09 },
    { key: 'other', amount: 636.3, share: 0.21 },
  ],
  recent: [
    {
      id: 'mv-1',
      date: '2026-10-16',
      description: 'Davivienda',
      category: 'housing',
      account: 'Bancolombia',
      amount: 1040,
      kind: 'expense',
    },
    {
      id: 'mv-2',
      date: '2026-10-15',
      description: 'Acme S.A.S.',
      category: 'salary',
      account: 'Bancolombia',
      amount: 4400,
      kind: 'income',
    },
    {
      id: 'mv-3',
      date: '2026-10-14',
      description: 'Exito',
      category: 'food',
      account: 'Visa 4417',
      amount: 186.2,
      kind: 'expense',
    },
    {
      id: 'mv-4',
      date: '2026-10-13',
      description: 'Globant',
      category: 'freelance',
      account: 'Wise',
      amount: 620,
      kind: 'income',
    },
    {
      id: 'mv-5',
      date: '2026-10-12',
      description: 'Uber',
      category: 'transport',
      account: 'Visa 4417',
      amount: 42.8,
      kind: 'expense',
    },
    {
      id: 'mv-6',
      date: '2026-10-11',
      description: 'Netflix',
      category: 'subscriptions',
      account: 'Visa 4417',
      amount: 27.9,
      kind: 'expense',
    },
  ],
};

@Injectable()
export class InMemoryDashboardRepository extends DashboardRepository {
  overview(): Observable<DashboardOverview> {
    return of(OVERVIEW);
  }
}
