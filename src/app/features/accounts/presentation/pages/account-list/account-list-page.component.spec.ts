import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { Account } from '../../../domain/account';
import { AccountError, AccountErrorCode } from '../../../domain/account-error';
import { FakeAccountRepository, fakeAccountsRoutes } from '../../account-repository.fake';

describe('AccountListPageComponent', () => {
  let fake: FakeAccountRepository;

  async function open(url = '/accounts') {
    const harness = await RouterTestingHarness.create(url);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  function click(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
  }

  function names(element: HTMLElement): string[] {
    return [
      ...element.querySelectorAll('[data-testid="account-rows"] [data-testid="row-name"]'),
    ].map((name) => name.textContent?.trim() ?? '');
  }

  function search(element: HTMLElement, value: string): void {
    const input = element.querySelector<HTMLInputElement>('[data-testid="account-search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function account(id: number, name: string, overrides: Partial<Account> = {}): Account {
    const base = {
      id,
      name,
      initialBalance: 0,
      currency: 'COP' as const,
      isActive: true,
      openingDate: '2026-10-20T00:00:00Z',
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: null,
      ...overrides,
    };
    return { ...base, currentBalance: overrides.currentBalance ?? base.initialBalance };
  }

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeAccountRepository();
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeAccountsRoutes(fake))],
    }).compileComponents();
  });

  it('shows the active accounts alphabetically with their currency and balance', async () => {
    const { element } = await open();

    expect(names(element)).toEqual(['Bancolombia', 'Visa 4417']);
    expect(element.querySelector('[data-testid="tab-active"]')?.textContent).toContain('2');
    expect(element.querySelector('[data-testid="tab-inactive"]')?.textContent).toContain('1');

    const visa = element.querySelector('[data-testid="account-5"]')!;
    expect(visa.textContent).toContain('Colombian peso (COP)');
    expect(visa.querySelector('[data-testid="row-balance"]')?.textContent).toContain('-COP');
    expect(visa.querySelector('a[href="/accounts/5/edit"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="menu-5"]')).toBeTruthy();
  });

  it('puts the create action at the top of the page', async () => {
    const { element } = await open();

    expect(element.querySelector('header [data-testid="new-account"]')?.getAttribute('href')).toBe(
      '/accounts/new',
    );
  });

  it('adds the active balances per currency without mixing currencies', async () => {
    fake.accounts.push(
      account(20, 'Nequi', { initialBalance: 300000 }),
      account(21, 'Payoneer', { currency: 'USD', initialBalance: 800 }),
    );
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open();

    const cop = element.querySelector('[data-testid="total-COP"]')!.textContent!;
    expect(cop).toContain('Pesos colombianos');
    expect(cop).toContain('1.300.000');
    expect(cop).toContain('3 cuentas activas');

    // Wise está desactivada: su saldo no cuenta en los dólares.
    const usd = element.querySelector('[data-testid="total-USD"]')!.textContent!;
    expect(usd).toContain('US$');
    expect(usd).toContain('800,00');
    expect(usd).toContain('1 cuenta activa');
    expect(element.querySelector('[data-testid="total-EUR"]')).toBeNull();
  });

  it('lists deactivated accounts in their own tab, only to look them up', async () => {
    const { harness, element } = await open();

    click(element, 'tab-inactive');
    harness.detectChanges();

    expect(names(element)).toEqual(['Wise']);
    expect(element.querySelector('[data-testid="account-8"] a')?.getAttribute('aria-label')).toBe(
      'View the Wise account',
    );
    expect(element.querySelector('[data-testid="menu-8"]')).toBeNull();
  });

  it('searches by name or currency ignoring case, with the matches per tab', async () => {
    const { harness, element } = await open();

    search(element, 'VISA');
    harness.detectChanges();
    expect(names(element)).toEqual(['Visa 4417']);
    expect(element.querySelector('[data-testid="tab-inactive"]')?.textContent).toContain('0');

    search(element, 'nómina');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="no-matches"]')?.textContent).toContain('nómina');
  });

  it('pages five accounts at a time and goes back to the first page on tab change', async () => {
    fake.accounts = Array.from({ length: 7 }, (_, index) =>
      account(100 + index, `Cuenta ${index + 1}`),
    );
    const { harness, element } = await open();

    expect(names(element)).toHaveLength(5);
    expect(element.querySelector('[data-testid="pagination"]')?.textContent).toContain(
      'Showing 1–5 of 7',
    );

    click(element, 'pagination-next');
    harness.detectChanges();
    expect(names(element)).toEqual(['Cuenta 6', 'Cuenta 7']);

    click(element, 'tab-inactive');
    harness.detectChanges();
    click(element, 'tab-active');
    harness.detectChanges();
    expect(names(element)).toHaveLength(5);
  });

  it('closes the actions menu with Escape and returns the focus', async () => {
    const { harness, element } = await open();

    click(element, 'menu-5');
    harness.detectChanges();
    const menu = element.querySelector('#account-menu-5')!;
    expect(element.querySelector('[data-testid="menu-5"]')?.getAttribute('aria-expanded')).toBe(
      'true',
    );

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();

    expect(element.querySelector('#account-menu-5')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('[data-testid="menu-5"]'));
  });

  it('asks before deactivating and moves the account to the other tab', async () => {
    const { harness, element } = await open();

    click(element, 'menu-5');
    harness.detectChanges();
    click(element, 'deactivate-5');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="deactivate-confirmation"]')?.textContent).toContain(
      'you can still look it up',
    );

    click(element, 'confirm-deactivate');
    harness.detectChanges();

    expect(names(element)).toEqual(['Bancolombia']);
    expect(element.querySelector('[data-testid="account-notice"]')?.textContent).toContain(
      'You deactivated the “Visa 4417” account.',
    );
    expect(element.querySelector('[data-testid="tab-inactive"]')?.textContent).toContain('2');
  });

  it('drops an account the backend no longer has', async () => {
    const { harness, element } = await open();
    fake.failWith = new AccountError('The account was not found.', AccountErrorCode.NotFound);

    click(element, 'menu-5');
    harness.detectChanges();
    click(element, 'deactivate-5');
    harness.detectChanges();
    click(element, 'confirm-deactivate');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="account-5"]')).toBeNull();
    expect(element.querySelector('[data-testid="deactivate-error"]')?.textContent).toContain(
      'The account was not found.',
    );
  });

  it('shows an empty state without totals when there are no accounts', async () => {
    fake.accounts = [];
    const { element } = await open();

    expect(element.querySelector('[data-testid="account-empty"]')?.textContent).toContain(
      'No active accounts yet',
    );
    expect(element.querySelector('[data-testid="account-totals"]')).toBeNull();
  });

  it('shows the load error with a retry', async () => {
    fake.failWith = new AccountError('Server down.');
    const { harness, element } = await open();

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain(
      'Server down.',
    );

    click(element, 'retry');
    harness.detectChanges();

    expect(names(element)).toHaveLength(2);
  });

  it('keeps the list beside the panel and marks the row being edited', async () => {
    const { element } = await open('/accounts/5/edit');

    expect(element.querySelector('[data-testid="account-panel"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="account-5"] a')?.getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('translates the view into Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open();

    expect(element.querySelector('h1')?.textContent).toContain('Cuentas');
    expect(element.textContent).toContain('Nueva cuenta');
    expect(element.textContent).toContain('Desactivadas');
  });
});
