import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { environment } from '@env/environment';
import { BudgetMovement } from '../domain/budget';
import { BudgetMovementsHttpRepository } from './budget-http.repository';

describe('Budget movements review', () => {
  it('review B4: includes movements after the first page', () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), BudgetMovementsHttpRepository],
    });
    const http = TestBed.inject(HttpTestingController);
    let result: BudgetMovement[] | undefined;
    const url = `${environment.apiUrl}/api/v1/transactions`;
    const ok = (data: unknown) => ({ data, isSuccess: true, message: '', errors: [] });
    const items = Array.from({ length: 51 }, (_, index) => ({
      id: index + 1, amount: 100, date: '2026-11-03T15:00:00Z', fromAccountId: 2, description: `Expense ${index + 1}`,
    }));
    TestBed.inject(BudgetMovementsHttpRepository)
      .list({ year: 2026, month: 11 }, { categoryId: 4, currency: 'COP', currencyId: 1 }, 'expense')
      .subscribe((value) => result = value);
    const first = http.expectOne((req) => req.url === url && req.params.get('page') === '1');
    expect(first.request.params.get('pageSize')).toBe('50');
    first.flush(ok({ items: items.slice(0, 50), page: 1, pageSize: 50, totalItems: 51 }));
    http.expectOne(`${environment.apiUrl}/api/v1/accounts`).flush(
      ok([{ id: 2, name: 'Bank', currency: 'COP', kind: 'standard' }]),
    );
    // Respond if requested; the assertion below also catches premature completion with only page 1.
    for (const next of http.match((req) => req.url === url && req.params.get('page') === '2')) {
      next.flush(ok({ items: items.slice(50), page: 2, pageSize: 50, totalItems: 51 }));
    }
    http.verify();

    expect(result?.map((item) => item.transactionId)).toEqual(items.map((item) => item.id));
  });
});
