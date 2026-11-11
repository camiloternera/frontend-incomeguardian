import { Routes } from '@angular/router';
import { FakePeriodRepository, provideFakePeriods } from '@features/periods/testing';
import { Observable, of, throwError } from 'rxjs';
import {
  BudgetCategoryOption,
  BudgetCategoryType,
  BudgetKey,
  BudgetMonth,
  BudgetMovement,
  BudgetRow,
  BudgetSummary,
  formatMonthKey,
} from '../domain/budget';
import {
  BudgetCategoryOptionsRepository,
  BudgetMovementsRepository,
  BudgetRepository,
  BudgetTarget,
} from '../domain/budget.repository';
import { budgetsRoutes } from '../budgets.routes';

/** Devuelve el error pendiente (una sola vez) o el valor calculado. */
function respond<T>(owner: { failWith: unknown }, value: () => T): Observable<T> {
  const error = owner.failWith;
  owner.failWith = null;

  return error ? throwError(() => error) : of(value());
}

/** Arma una fila del resumen con valores por defecto razonables. */
export function budgetRow(overrides: Partial<BudgetRow> & Pick<BudgetRow, 'categoryId' | 'categoryName'>): BudgetRow {
  const budgetAmount = overrides.budgetAmount ?? 0;
  const spentAmount = overrides.spentAmount ?? 0;

  return {
    categoryType: 'expense',
    currency: 'COP',
    budgetAmount,
    spentAmount,
    availableAmount: budgetAmount - spentAmount,
    percentUsed: budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 1000) / 10 : null,
    recurringAmount: null,
    source: 'recurring',
    monthAmount: null,
    installmentsRaise: 0,
    installmentsSpent: 0,
    installments: [],
    ...overrides,
  };
}

/** Resumen de ejemplo: pesos con varios estados y una fila en dólares. */
export function sampleSummary(month: BudgetMonth): BudgetSummary {
  return {
    ...month,
    isClosed: false,
    rows: [
      budgetRow({ categoryId: 1, categoryName: 'Alimentación', budgetAmount: 850000, spentAmount: 30000, source: 'month', recurringAmount: 800000 }),
      budgetRow({ categoryId: 3, categoryName: 'Suscripciones', budgetAmount: 60000, spentAmount: 74900 }),
      budgetRow({ categoryId: 4, categoryName: 'Vivienda', budgetAmount: 1800000, spentAmount: 1800000 }),
      budgetRow({ categoryId: 5, categoryName: 'Salud', spentAmount: 38200, source: 'none' }),
      budgetRow({ categoryId: 6, categoryName: 'Gimnasio', source: 'month', recurringAmount: 120000 }),
      budgetRow({ categoryId: 7, categoryName: 'Salidas al cine', budgetAmount: 80000, spentAmount: 25000 }),
      budgetRow({ categoryId: 8, categoryName: 'Software', currency: 'USD', budgetAmount: 40, spentAmount: 24 }),
    ],
    totals: [
      { currency: 'COP', budget: 2790000, spent: 1968100, available: 821900, installmentsSpent: 0 },
      { currency: 'USD', budget: 40, spent: 24, available: 16, installmentsSpent: 0 },
    ],
  };
}

/** Presupuesto en memoria: devuelve el resumen de cada mes y anota cada escritura. */
export class FakeBudgetRepository extends BudgetRepository {
  /** Resumen por mes (`YYYY-MM`); un mes sin entrada vuelve vacío. */
  summaries: Record<string, BudgetSummary> = {};
  failWith: unknown = null;
  /** Error de la próxima escritura; el resumen usa `failWith`. */
  writeFailWith: unknown = null;
  requested: BudgetMonth[] = [];
  calls: { action: string; args: unknown[] }[] = [];

  summary(month: BudgetMonth): Observable<BudgetSummary> {
    this.requested.push(month);

    return respond(this, () => this.summaries[formatMonthKey(month)] ?? { ...month, isClosed: false, rows: [], totals: [] });
  }

  saveRecurring(target: BudgetTarget, amount: number, from: BudgetMonth): Observable<void> {
    return this.write('saveRecurring', [target, amount, from]);
  }

  removeRecurring(key: BudgetKey, from: BudgetMonth): Observable<void> {
    return this.write('removeRecurring', [{ categoryId: key.categoryId, currency: key.currency }, from]);
  }

  saveMonth(month: BudgetMonth, target: BudgetTarget, amount: number): Observable<void> {
    return this.write('saveMonth', [month, target, amount]);
  }

  removeMonth(month: BudgetMonth, key: BudgetKey): Observable<void> {
    return this.write('removeMonth', [month, { categoryId: key.categoryId, currency: key.currency }]);
  }

  private write(action: string, args: unknown[]): Observable<void> {
    this.calls.push({ action, args });
    const owner = { failWith: this.writeFailWith };
    this.writeFailWith = null;

    return respond(owner, () => undefined);
  }
}

/** Categorías en memoria: gastos, una transferencia, un ingreso y una desactivada. */
export class FakeBudgetCategoryOptionsRepository extends BudgetCategoryOptionsRepository {
  categories: BudgetCategoryOption[] = [
    { id: 1, name: 'Alimentación', type: 'expense', isActive: true },
    { id: 2, name: 'Transporte', type: 'expense', isActive: true },
    { id: 3, name: 'Suscripciones', type: 'expense', isActive: true },
    { id: 4, name: 'Vivienda', type: 'expense', isActive: true },
    { id: 5, name: 'Salud', type: 'expense', isActive: true },
    { id: 6, name: 'Gimnasio', type: 'expense', isActive: true },
    { id: 7, name: 'Salidas al cine', type: 'expense', isActive: false },
    { id: 8, name: 'Software', type: 'expense', isActive: true },
    { id: 9, name: 'Ahorro para viaje', type: 'transfer', isActive: true },
    { id: 10, name: 'Salario', type: null, isActive: true },
  ];
  failWith: unknown = null;

  list(): Observable<BudgetCategoryOption[]> {
    return respond(this, () => [...this.categories]);
  }
}

/** Gastos de cuentas normales en memoria; devuelve `movements` y anota cada pedido. */
export class FakeBudgetMovementsRepository extends BudgetMovementsRepository {
  movements: BudgetMovement[] = [];
  failWith: unknown = null;
  requested: { month: BudgetMonth; key: BudgetKey; type: BudgetCategoryType }[] = [];

  list(month: BudgetMonth, key: BudgetKey, type: BudgetCategoryType): Observable<BudgetMovement[]> {
    this.requested.push({ month, key, type });

    return respond(this, () => [...this.movements]);
  }
}

/** Los puertos falsos del dominio y el cierre de períodos. */
export class BudgetFakes {
  readonly budgets = new FakeBudgetRepository();
  readonly categories = new FakeBudgetCategoryOptionsRepository();
  readonly movements = new FakeBudgetMovementsRepository();
  readonly periods = new FakePeriodRepository();
}

/** Las rutas reales del dominio montadas en `/budgets`, con los puertos falsos en lugar de los HTTP. */
export function fakeBudgetsRoutes(fakes = new BudgetFakes()): Routes {
  const [root] = budgetsRoutes;

  return [
    {
      path: 'budgets',
      children: [
        {
          ...root,
          providers: [
            ...(root.providers ?? []),
            { provide: BudgetRepository, useValue: fakes.budgets },
            { provide: BudgetCategoryOptionsRepository, useValue: fakes.categories },
            { provide: BudgetMovementsRepository, useValue: fakes.movements },
            ...provideFakePeriods(fakes.periods),
          ],
        },
      ],
    },
  ];
}
