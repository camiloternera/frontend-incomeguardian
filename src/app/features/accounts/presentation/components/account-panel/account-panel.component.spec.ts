import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { AccountError, AccountErrorCode } from '../../../domain/account-error';
import { FakeAccountRepository, fakeAccountsRoutes } from '../../account-repository.fake';

describe('AccountPanelComponent', () => {
  let fake: FakeAccountRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeAccountRepository();
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeAccountsRoutes(fake))],
    }).compileComponents();
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  function type(element: HTMLElement, testId: string, value: string): void {
    const field = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
  }

  function click(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
  }

  function submit(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  it('asks only for name, currency and balance', async () => {
    const { element } = await open('/accounts/new');

    expect(element.querySelector('[data-testid="account-type"]')).toBeNull();
    expect(element.querySelector<HTMLInputElement>('[data-testid="currency-COP"]')!.checked).toBe(
      true,
    );
    expect(element.querySelector('[data-testid="currency-USD"]')).toBeTruthy();
    // EUR ya no se admite para cuentas nuevas.
    expect(element.querySelector('[data-testid="currency-EUR"]')).toBeNull();
  });

  it('validates the fields locally before calling the backend', async () => {
    const { harness, element } = await open('/accounts/new');

    type(element, 'account-name', 'x'.repeat(51));
    type(element, 'account-balance', '1.2345');
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain(
      'The name can be up to 50 characters.',
    );
    expect(element.querySelector('[data-testid="balance-error"]')?.textContent).toContain(
      'up to 3 decimals',
    );
    expect(fake.lastDraft).toBeNull();
  });

  it('shows the symbol of the chosen currency beside the balance', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { harness, element } = await open('/accounts/new');

    expect(element.querySelector('[data-testid="balance-symbol"]')?.textContent).toContain('$');

    click(element, 'currency-USD');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="balance-symbol"]')?.textContent).toContain('US$');
  });

  it('creates an account with a negative balance written with a comma and adds it to the list', async () => {
    const { harness, element } = await open('/accounts/new');

    type(element, 'account-name', '  Visa 9000 ');
    click(element, 'currency-USD');
    type(element, 'account-balance', '-1250,5');
    submit(element);
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(fake.lastDraft).toEqual({
      name: 'Visa 9000',
      currency: 'USD',
      initialBalance: -1250.5,
    });
    expect(TestBed.inject(Router).url).toBe('/accounts');
    expect(element.querySelector('[data-testid="account-99"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="account-notice"]')?.textContent).toContain(
      'Visa 9000',
    );
  });

  it('shows a locked currency beside the currency field', async () => {
    const { harness, element } = await open('/accounts/5/edit');
    fake.failWith = new AccountError(
      'The account already has transactions.',
      AccountErrorCode.CurrencyLocked,
    );

    click(element, 'currency-USD');
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="currency-error"]')?.textContent).toContain(
      'The account already has transactions, so its currency cannot change.',
    );
    expect(element.querySelector('[data-testid="form-error"]')).toBeNull();
  });

  it('loads the account to edit and focuses the panel title', async () => {
    const { element } = await open('/accounts/5/edit');

    expect(element.querySelector('h2')?.textContent).toContain('Edit account');
    expect(element.querySelector<HTMLInputElement>('[data-testid="account-name"]')?.value).toBe(
      'Visa 4417',
    );
    expect(element.querySelector<HTMLInputElement>('[data-testid="account-balance"]')?.value).toBe(
      '-250000',
    );
    expect(document.activeElement?.id).toBe('account-panel-title');
  });

  it('switches to another account when the row changes', async () => {
    const { harness, element } = await open('/accounts/5/edit');

    await harness.navigateByUrl('/accounts/2/edit');

    expect(element.querySelector<HTMLInputElement>('[data-testid="account-name"]')?.value).toBe(
      'Bancolombia',
    );
  });

  it('deactivates the account from the panel after confirming', async () => {
    const { harness, element } = await open('/accounts/5/edit');

    click(element, 'panel-deactivate');
    harness.detectChanges();
    click(element, 'panel-confirm-deactivate');
    await harness.fixture.whenStable();

    expect(fake.accounts.find((account) => account.id === 5)?.isActive).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/accounts');
  });

  it('closes with Escape only while there are no unsaved changes', async () => {
    const { harness, element } = await open('/accounts/5/edit');
    const panel = element.querySelector('[data-testid="account-panel"]')!;

    type(element, 'account-name', 'Visa nueva');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/accounts/5/edit');
  });

  it('opens a deactivated account read-only', async () => {
    const { element } = await open('/accounts/8/edit');

    const summary = element.querySelector('[data-testid="account-read-only"]')?.textContent;
    expect(summary).toContain('This account is deactivated');
    expect(summary).toContain('$320.50');
    expect(element.querySelector('h2')?.textContent).toContain('Wise');
    expect(element.querySelector('form')).toBeNull();
  });

  it('explains when the account does not exist', async () => {
    const { element } = await open('/accounts/404/edit');

    expect(element.querySelector('h2')?.textContent).toContain('Account unavailable');
    expect(element.querySelector('[data-testid="account-not-found"]')).toBeTruthy();
  });
});
