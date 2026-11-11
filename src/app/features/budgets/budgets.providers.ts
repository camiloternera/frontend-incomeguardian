import { Provider } from '@angular/core';
import {
  GetBudgetSummaryUseCase,
  ListBudgetCategoryOptionsUseCase,
  ListBudgetMovementsUseCase,
  RemoveBudgetUseCase,
  ResetMonthBudgetUseCase,
  SaveBudgetUseCase,
} from './application/budget-use-cases';
import {
  BudgetCategoryOptionsRepository,
  BudgetMovementsRepository,
  BudgetRepository,
} from './domain/budget.repository';
import {
  BudgetCategoryOptionsHttpRepository,
  BudgetHttpRepository,
  BudgetMovementsHttpRepository,
} from './infrastructure/budget-http.repository';

/** Casos de uso del dominio; los tests los registran junto con puertos falsos. */
export const BUDGET_USE_CASES: Provider[] = [
  GetBudgetSummaryUseCase,
  SaveBudgetUseCase,
  RemoveBudgetUseCase,
  ResetMonthBudgetUseCase,
  ListBudgetCategoryOptionsUseCase,
  ListBudgetMovementsUseCase,
];

/**
 * Enlaza los puertos de presupuestos con sus adaptadores. Se registra en `budgets.routes.ts`
 * para que los adaptadores queden dentro del chunk diferido.
 */
export function provideBudgets(): Provider[] {
  return [
    { provide: BudgetRepository, useClass: BudgetHttpRepository },
    { provide: BudgetCategoryOptionsRepository, useClass: BudgetCategoryOptionsHttpRepository },
    { provide: BudgetMovementsRepository, useClass: BudgetMovementsHttpRepository },
    ...BUDGET_USE_CASES,
  ];
}
