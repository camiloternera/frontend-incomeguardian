import { TestBed } from '@angular/core/testing';
import { BudgetCategoryOptionsRepository, BudgetRepository } from '../domain/budget.repository';
import { FakeBudgetCategoryOptionsRepository, FakeBudgetRepository } from '../presentation/budget-repository.fake';
import { BUDGET_USE_CASES } from '../budgets.providers';
import { ListBudgetCategoryOptionsUseCase, SaveBudgetUseCase } from './budget-use-cases';

describe('budget use cases', () => {
  let budgets: FakeBudgetRepository;

  beforeEach(() => {
    budgets = new FakeBudgetRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetRepository, useValue: budgets },
        { provide: BudgetCategoryOptionsRepository, useClass: FakeBudgetCategoryOptionsRepository },
        ...BUDGET_USE_CASES,
      ],
    });
  });

  it('saves a recurring limit from the month on, or a limit for that month only', () => {
    const save = TestBed.inject(SaveBudgetUseCase);
    const month = { year: 2026, month: 11 };

    save.execute({ categoryId: 4, currency: 'COP', amount: 1800000, month, scope: 'recurring' }).subscribe();
    save.execute({ categoryId: 6, currency: 'USD', amount: 0, month, scope: 'month' }).subscribe();

    expect(budgets.calls).toEqual([
      { action: 'saveRecurring', args: [{ categoryId: 4, currency: 'COP' }, 1800000, month] },
      { action: 'saveMonth', args: [month, { categoryId: 6, currency: 'USD' }, 0] },
    ]);
  });

  it('lists the categories by name ignoring accents', () => {
    let names: string[] = [];
    TestBed.inject(ListBudgetCategoryOptionsUseCase)
      .execute()
      .subscribe((items) => (names = items.map((item) => item.name)));

    expect(names.slice(0, 3)).toEqual(['Ahorro para viaje', 'Alimentación', 'Gimnasio']);
  });
});
