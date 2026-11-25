import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { provideFakeCurrencyCatalog } from '@core/currencies/currency-catalog.testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { Account } from '../../../domain/account';
import { FakeAccountRepository, fakeAccountsRoutes } from '../../account-repository.fake';

describe('Account edit review', () => {
  it('review B1: keeps the current account data after an older request completes', async () => {
    localStorage.clear();
    const fake = new FakeAccountRepository();
    const base = fake.accounts[0];
    const a: Account = {
      ...base, id: 101, name: 'Account A', currency: 'COP', currencyId: 1,
      initialBalance: 1000, currentBalance: 1000, hasTransactions: false, isActive: true,
    };
    const b: Account = { ...a, id: 102, name: 'Account B', initialBalance: 2000, currentBalance: 2000 };
    fake.accounts = [a, b];
    const first = new Subject<Account>();
    const second = new Subject<Account>();
    vi.spyOn(fake, 'get').mockImplementation((id) => id === a.id ? first : second);
    const update = vi.spyOn(fake, 'update');
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeAccountsRoutes(fake)), ...provideFakeCurrencyCatalog()],
    }).compileComponents();
    const harness = await RouterTestingHarness.create('/accounts/101/edit');
    await harness.navigateByUrl('/accounts/102/edit');
    second.next(b);
    second.complete();
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement!;
    expect(element.querySelector<HTMLInputElement>('[data-testid="account-name"]')!.value).toBe('Account B');
    first.next(a);
    first.complete();
    await harness.fixture.whenStable();
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();

    expect(update).toHaveBeenCalledWith(102, expect.objectContaining({ name: 'Account B', initialBalance: 2000 }));
  });
});
