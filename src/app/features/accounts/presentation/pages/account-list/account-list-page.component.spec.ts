import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { Account } from '../../../domain/account';
import { AccountError } from '../../../domain/account-error';
import { FakeAccountRepository, provideFakeAccounts } from '../../account-repository.fake';
import { AccountListPageComponent } from './account-list-page.component';

describe('AccountListPageComponent', () => {
  let fake: FakeAccountRepository;

  function render() {
    const fixture = TestBed.createComponent(AccountListPageComponent);
    fixture.detectChanges();

    return fixture;
  }

  function click(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
  }

  function names(element: HTMLElement): (string | undefined)[] {
    return [...element.querySelectorAll('[data-testid="account-rows"] h2')].map((h2) => h2.textContent?.trim());
  }

  function search(element: HTMLElement, value: string): void {
    const input = element.querySelector<HTMLInputElement>('[data-testid="account-search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeAccountRepository();
    await TestBed.configureTestingModule({
      imports: [AccountListPageComponent, translocoTesting()],
      providers: [provideRouter([]), provideFakeAccounts(fake)],
    }).compileComponents();
  });

  it('shows the active accounts alphabetically with their type and opening balance', () => {
    const element = render().nativeElement as HTMLElement;

    expect(names(element)).toEqual(['Bancolombia', 'Visa 4417']);
    expect(element.querySelector('[data-testid="filter-active"]')?.textContent).toContain('2');
    expect(element.querySelector('[data-testid="filter-inactive"]')?.textContent).toContain('1');

    const visa = element.querySelector('[data-testid="account-5"]')!;
    expect(visa.textContent).toContain('Tarjeta de crédito · COP');
    expect(visa.querySelector('[data-testid="account-balance"]')?.textContent).toContain('-COP');
    expect(visa.querySelector('a[href="/5/edit"]')).toBeTruthy();
  });

  it('formats each balance in its own currency', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    click(element, 'filter-inactive');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="account-8"] [data-testid="account-balance"]')?.textContent).toContain('320,50');
    expect(element.querySelector('[data-testid="account-8"] [data-testid="account-balance"]')?.textContent).toContain('US$');
  });

  it('lists deactivated accounts apart and only to look them up', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    click(element, 'filter-inactive');
    fixture.detectChanges();

    expect(names(element)).toEqual(['Wise']);
    expect(element.querySelector('[data-testid="account-8"]')?.textContent).toContain('Deactivated');
    expect(element.querySelector('[data-testid="account-8"] a')?.textContent).toContain('View');
    expect(element.querySelector('[data-testid="deactivate-8"]')).toBeNull();
  });

  it('searches by name or account type', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    search(element, 'credito');
    fixture.detectChanges();

    expect(names(element)).toEqual(['Visa 4417']);
    expect(element.querySelector('[data-testid="search-count"]')?.textContent).toContain('1 of 2');
  });

  it('moves a deactivated account to the other filter', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    click(element, 'deactivate-5');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="deactivate-confirmation"]')?.textContent).toContain('you can still look it up');

    click(element, 'confirm-deactivate');
    fixture.detectChanges();

    expect(names(element)).toEqual(['Bancolombia']);
    expect(element.querySelector('[data-testid="account-notice"]')?.textContent).toContain('You deactivated the “Visa 4417” account.');
    expect(element.querySelector('[data-testid="filter-inactive"]')?.textContent).toContain('2');
  });

  it('invites to create the first account when there are none', () => {
    fake.accounts = [];
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="account-empty"]')?.textContent).toContain('No active accounts yet');
    expect(element.querySelector('[data-testid="account-search"]')).toBeNull();
  });

  it('shows the load error with a retry', () => {
    fake.failWith = new AccountError('Server down.');
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain('Server down.');

    element.querySelector<HTMLButtonElement>('[data-testid="load-error"] + button')!.click();
    fixture.detectChanges();

    expect(names(element)).toHaveLength(2);
  });

  it('paginates the active accounts', () => {
    fake.accounts = Array.from(
      { length: 10 },
      (_, index): Account => ({
        id: 100 + index,
        name: `Cuenta ${String(index + 1).padStart(2, '0')}`,
        accountType: { id: 1, name: 'Ahorros' },
        initialBalance: 0,
        currency: 'COP',
        isActive: true,
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: null,
      }),
    );
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    expect(names(element)).toHaveLength(8);

    click(element, 'pagination-next');
    fixture.detectChanges();

    expect(names(element)).toEqual(['Cuenta 09', 'Cuenta 10']);
  });

  it('translates the view into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Cuentas');
    expect(element.textContent).toContain('Nueva cuenta');
    expect(element.textContent).toContain('Desactivadas');
  });
});
