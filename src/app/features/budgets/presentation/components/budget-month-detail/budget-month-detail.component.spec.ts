import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { ListBudgetMovementsUseCase } from '../../../application/budget-use-cases';
import { BudgetInstallment, BudgetRow } from '../../../domain/budget';
import { BudgetError } from '../../../domain/budget-error';
import { BudgetMovementsRepository } from '../../../domain/budget.repository';
import { FakeBudgetMovementsRepository, budgetRow } from '../../budget-repository.fake';
import { BudgetMonthDetailComponent } from './budget-month-detail.component';

const NOVEMBER = { year: 2026, month: 11 };

function installment(overrides: Partial<BudgetInstallment> & Pick<BudgetInstallment, 'transactionId'>): BudgetInstallment {
  return {
    description: 'Televisor',
    number: 2,
    installments: 6,
    accountId: 9,
    accountName: 'Visa Oro',
    purchaseDate: '2026-10-20',
    amount: 50000,
    budgetAdjustment: 0,
    ...overrides,
  };
}

describe('BudgetMonthDetailComponent', () => {
  let movements: FakeBudgetMovementsRepository;
  let fixture: ComponentFixture<BudgetMonthDetailComponent>;

  beforeEach(async () => {
    localStorage.clear();
    movements = new FakeBudgetMovementsRepository();
    await TestBed.configureTestingModule({
      imports: [translocoTesting(), BudgetMonthDetailComponent],
      providers: [
        provideRouter([]),
        ListBudgetMovementsUseCase,
        { provide: BudgetMovementsRepository, useValue: movements },
      ],
    }).compileComponents();
  });

  async function render(row: BudgetRow, month = NOVEMBER): Promise<HTMLElement> {
    fixture = TestBed.createComponent(BudgetMonthDetailComponent);
    fixture.componentRef.setInput('row', row);
    fixture.componentRef.setInput('month', month);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function lines(element: HTMLElement): string[] {
    return [...element.querySelectorAll('[data-testid="budget-spent-lines"] li')].map((item) => text(item));
  }

  it('hides the breakdown of the limit when installments did not raise it', async () => {
    const element = await render(
      budgetRow({ categoryId: 1, categoryName: 'Hogar', budgetAmount: 800000, recurringAmount: 800000, installments: [installment({ transactionId: 41, budgetAdjustment: 50000 })] }),
    );

    expect(element.querySelector('[data-testid="budget-cap-lines"]')).toBeNull();
  });

  it('breaks down the limit into the recurring amount and each installment that raised it', async () => {
    const element = await render(
      budgetRow({
        categoryId: 1,
        categoryName: 'Hogar',
        budgetAmount: 900000,
        recurringAmount: 800000,
        installmentsRaise: 100000,
        installments: [
          installment({ transactionId: 41, budgetAdjustment: 50000 }),
          installment({ transactionId: 42, description: null, number: 3, installments: 12, budgetAdjustment: 50000 }),
          // Una cuota que no subió el tope no aparece en el desglose.
          installment({ transactionId: 43, description: 'Nevera', budgetAdjustment: 0 }),
        ],
      }),
    );

    expect(text(element.querySelector('#budget-cap-title'))).toBe('November 2026 budget');
    const cap = text(element.querySelector('[data-testid="budget-cap-lines"]'));
    expect(cap).toContain('Recurring budget');
    expect(cap).toContain('800,000');
    expect(cap).toContain('Installment 2/6 of Televisor');
    expect(cap).toContain('Installment 3/12 of No description');
    expect(cap).not.toContain('Nevera');
    expect(cap).toContain("This month's budget");
    expect(cap).toContain('900,000');
  });

  it('leaves out the recurring line when there is no recurring limit', async () => {
    const element = await render(
      budgetRow({
        categoryId: 1,
        categoryName: 'Hogar',
        budgetAmount: 50000,
        recurringAmount: null,
        installmentsRaise: 50000,
        installments: [installment({ transactionId: 41, budgetAdjustment: 50000 })],
      }),
    );

    expect(text(element.querySelector('[data-testid="budget-cap-lines"]'))).not.toContain('Recurring budget');
  });

  it('asks the standard account movements of the category, month and currency', async () => {
    await render(budgetRow({ categoryId: 4, categoryName: 'Mercado', currency: 'USD', categoryType: 'expense' }));

    expect(movements.requested).toEqual([{ month: NOVEMBER, key: { categoryId: 4, currency: 'USD' }, type: 'expense' }]);
  });

  it('does not ask for movements when the category type is unknown', async () => {
    const element = await render(budgetRow({ categoryId: 4, categoryName: 'Rara', categoryType: null }));

    expect(movements.requested).toEqual([]);
    expect(text(element)).toContain('No spending in this category this month yet.');
  });

  it('joins the installments and the movements, newest first', async () => {
    movements.movements = [
      { transactionId: 7, description: 'Mercado', accountName: 'Bancolombia', date: '2026-11-03T15:00:00Z', amount: 30000 },
    ];
    const element = await render(
      budgetRow({
        categoryId: 1,
        categoryName: 'Hogar',
        installments: [
          installment({ transactionId: 41, purchaseDate: '2026-10-20' }),
          installment({ transactionId: 44, description: 'Audífonos', number: 1, installments: 1, purchaseDate: '2026-11-08', amount: 20000 }),
        ],
      }),
    );

    expect(lines(element)).toEqual([
      expect.stringContaining('Audífonos'),
      expect.stringContaining('Mercado'),
      expect.stringContaining('Televisor'),
    ]);
    const [single, movement, purchase] = lines(element);
    expect(single).toContain('1 installment');
    expect(single).toContain('Visa Oro');
    expect(movement).toContain('Bancolombia');
    expect(movement).toContain('30,000');
    expect(purchase).toContain('Installment 2 of 6');
    expect(element.querySelector('[data-testid="budget-spent-lines"] a[href="/transactions/41"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="budget-spent-lines"] a[href="/transactions/7"]')).toBeTruthy();
  });

  it('says when nothing counts this month', async () => {
    const element = await render(budgetRow({ categoryId: 1, categoryName: 'Hogar' }));

    expect(element.querySelector('[data-testid="budget-spent-lines"]')).toBeNull();
    expect(text(element)).toContain('No spending in this category this month yet.');
  });

  it('shows the error of the movements', async () => {
    movements.failWith = new BudgetError('Could not load the movements');
    const element = await render(budgetRow({ categoryId: 1, categoryName: 'Hogar' }));

    expect(text(element.querySelector('[data-testid="budget-spent-error"]'))).toBe('Could not load the movements');
  });

  it('asks again when the month changes', async () => {
    await render(budgetRow({ categoryId: 1, categoryName: 'Hogar' }));

    fixture.componentRef.setInput('month', { year: 2026, month: 12 });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(movements.requested.map((request) => request.month)).toEqual([NOVEMBER, { year: 2026, month: 12 }]);
  });

  it('translates the detail into Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const element = await render(
      budgetRow({
        categoryId: 1,
        categoryName: 'Hogar',
        budgetAmount: 900000,
        recurringAmount: 800000,
        installmentsRaise: 100000,
        installments: [installment({ transactionId: 41, budgetAdjustment: 100000 })],
      }),
    );

    expect(text(element.querySelector('#budget-spent-title'))).toBe('Lo que cuenta este mes');
    expect(text(element.querySelector('[data-testid="budget-cap-lines"]'))).toContain('Cuota 2/6');
  });
});
