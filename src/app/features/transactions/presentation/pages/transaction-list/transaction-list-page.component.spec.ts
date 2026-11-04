import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { TransactionError } from '../../../domain/transaction-error';
import { TransactionFakes, fakeTransactionsRoutes, transaction } from '../../transaction-repository.fake';

describe('TransactionListPageComponent', () => {
  let fakes: TransactionFakes;

  async function open(url = '/transactions') {
    const harness = await RouterTestingHarness.create(url);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  async function settle(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function click(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
  }

  function descriptions(element: HTMLElement): string[] {
    return [...element.querySelectorAll('[data-testid="row-description"]')].map(
      (item) => item.textContent?.trim() ?? '',
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    fakes = new TransactionFakes();
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeTransactionsRoutes(fakes))],
    }).compileComponents();
  });

  it('loads the first page of 5 and resolves account and category names', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open();

    expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5 });
    expect(descriptions(element)).toEqual(['Mercado semanal', 'Salario', 'Transferencia']);

    const expense = element.querySelector('[data-testid="transaction-1"]')!;
    expect(expense.querySelector('[data-testid="row-meta"]')?.textContent).toContain('Mercado · Bancolombia');
    expect(expense.querySelector('[data-testid="row-amount"]')?.textContent).toContain('−');
    expect(expense.querySelector('[data-testid="row-amount"]')?.textContent).toContain('52.300');

    const transfer = element.querySelector('[data-testid="transaction-3"]')!;
    expect(transfer.querySelector('[data-testid="row-meta"]')?.textContent).toContain('Bancolombia → Wise');
    expect(transfer.querySelector('[data-testid="row-destination"]')?.textContent).toContain('US$');
    expect(transfer.querySelector('[data-testid="row-destination"]')?.textContent).toContain('101,27');
  });

  it('puts the create action at the top of the page', async () => {
    const { element } = await open();

    expect(element.querySelector('header [data-testid="new-transaction"]')?.getAttribute('href')).toBe(
      '/transactions/new/expense',
    );
  });

  it('switches tabs through ?type= and reloads from page 1', async () => {
    for (let id = 10; id < 16; id++) {
      fakes.transactions.transactions.push(transaction(id, 'expense', 1000, { fromAccountId: 3 }));
    }
    const { harness, element } = await open();

    click(element, 'pagination-next');
    harness.detectChanges();
    expect(fakes.transactions.lastQuery).toEqual({ page: 2, pageSize: 5 });

    click(element, 'tab-income');
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/transactions?type=income');
    expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5, type: 'income' });
    expect(descriptions(element)).toEqual(['Salario']);
    expect(element.querySelector('[data-testid="tab-income"]')?.getAttribute('aria-pressed')).toBe('true');

    click(element, 'tab-all');
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/transactions');
  });

  it('reads the type filter from the URL', async () => {
    await open('/transactions?type=transfer');

    expect(fakes.transactions.lastQuery).toEqual({ page: 1, pageSize: 5, type: 'transfer' });
  });

  it('shows an empty state for the chosen tab', async () => {
    fakes.transactions.transactions = fakes.transactions.transactions.filter((item) => item.type !== 'transfer');
    const { element } = await open('/transactions?type=transfer');

    expect(element.querySelector('[data-testid="transaction-empty"]')?.textContent).toContain('No transfers');
    expect(element.querySelector('[data-testid="transaction-rows"]')).toBeNull();
  });

  it('offers a retry when the list fails to load', async () => {
    fakes.transactions.failWith = new TransactionError('The service is down.');
    const { harness, element } = await open();

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain('The service is down.');

    click(element, 'retry');
    harness.detectChanges();

    expect(descriptions(element)).toHaveLength(3);
  });
});
