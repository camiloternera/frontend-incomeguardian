import { Provider } from '@angular/core';
import {
  GetBudgetSummaryUseCase,
  ListBudgetCategoryOptionsUseCase,
  RemoveBudgetUseCase,
  ResetMonthBudgetUseCase,
  SaveBudgetUseCase,
} from './application/budget-use-cases';
import { BudgetCategoryOptionsRepository, BudgetRepository } from './domain/budget.repository';
import { BudgetCategoryOptionsHttpRepository, BudgetHttpRepository } from './infrastructure/budget-http.repository';

/** Casos de uso del dominio; los tests los registran junto con puertos falsos. */
export const BUDGET_USE_CASES: Provider[] = [
  GetBudgetSummaryUseCase,
  SaveBudgetUseCase,
  RemoveBudgetUseCase,
  ResetMonthBudgetUseCase,
  ListBudgetCategoryOptionsUseCase,
];

/**
 * Enlaza los puertos de presupuestos con sus adaptadores. Se registra en `budgets.routes.ts`
 * para que los adaptadores queden dentro del chunk diferido.
 */
export function provideBudgets(): Provider[] {
  return [
    { provide: BudgetRepository, useClass: BudgetHttpRepository },
    { provide: BudgetCategoryOptionsRepository, useClass: BudgetCategoryOptionsHttpRepository },
    ...BUDGET_USE_CASES,
  ];
}
