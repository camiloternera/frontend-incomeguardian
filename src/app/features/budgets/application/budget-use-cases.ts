import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  BudgetCategoryOption,
  BudgetCategoryType,
  BudgetDraft,
  BudgetKey,
  BudgetMonth,
  BudgetMovement,
  BudgetSummary,
} from '../domain/budget';
import {
  BudgetCategoryOptionsRepository,
  BudgetMovementsRepository,
  BudgetRepository,
} from '../domain/budget.repository';

@Injectable()
export class GetBudgetSummaryUseCase {
  private readonly repository = inject(BudgetRepository);

  execute(month: BudgetMonth): Observable<BudgetSummary> {
    return this.repository.summary(month);
  }
}

@Injectable()
export class SaveBudgetUseCase {
  private readonly repository = inject(BudgetRepository);

  /** «Desde {mes} en adelante» fija el recurrente; «Solo {mes}» guarda un tope propio del mes. */
  execute(draft: BudgetDraft): Observable<void> {
    const target = { categoryId: draft.categoryId, currency: draft.currency };

    return draft.scope === 'recurring'
      ? this.repository.saveRecurring(target, draft.amount, draft.month)
      : this.repository.saveMonth(draft.month, target, draft.amount);
  }
}

@Injectable()
export class RemoveBudgetUseCase {
  private readonly repository = inject(BudgetRepository);

  /** Deja la categoría sin tope desde el mes indicado en adelante. */
  execute(key: BudgetKey, from: BudgetMonth): Observable<void> {
    return this.repository.removeRecurring(key, from);
  }
}

@Injectable()
export class ResetMonthBudgetUseCase {
  private readonly repository = inject(BudgetRepository);

  /** Quita el tope propio del mes para que vuelva a regir el recurrente. */
  execute(month: BudgetMonth, key: BudgetKey): Observable<void> {
    return this.repository.removeMonth(month, key);
  }
}

@Injectable()
export class ListBudgetCategoryOptionsUseCase {
  private readonly repository = inject(BudgetCategoryOptionsRepository);

  /** Todas las categorías, ordenadas por nombre sin distinguir mayúsculas ni tildes. */
  execute(): Observable<BudgetCategoryOption[]> {
    return this.repository
      .list()
      .pipe(map((items) => [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))));
  }
}

@Injectable()
export class ListBudgetMovementsUseCase {
  private readonly repository = inject(BudgetMovementsRepository);

  /** Gastos de cuentas normales de la categoría en el mes, del más reciente al más antiguo. */
  execute(month: BudgetMonth, key: BudgetKey, type: BudgetCategoryType): Observable<BudgetMovement[]> {
    return this.repository.list(month, key, type);
  }
}
