import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { AccountError, AccountErrorCode } from '../../../domain/account-error';
import {
  FakeAccountRepository,
  FakeAccountTypeOptionsRepository,
  provideFakeAccounts,
} from '../../account-repository.fake';
import { AccountFormPageComponent } from './account-form-page.component';

describe('AccountFormPageComponent', () => {
  let fake: FakeAccountRepository;
  let options: FakeAccountTypeOptionsRepository;

  async function setup(id: string | null, configure?: () => void) {
    localStorage.clear();
    fake = new FakeAccountRepository();
    options = new FakeAccountTypeOptionsRepository();
    configure?.();
    await TestBed.configureTestingModule({
      imports: [AccountFormPageComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        provideFakeAccounts(fake, options),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AccountFormPageComponent);
    fixture.detectChanges();

    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, testId: string, value: string): void {
    const field = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
  }

  function choose(element: HTMLElement, testId: string, label: string): void {
    const select = element.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`)!;
    select.selectedIndex = [...select.options].findIndex((option) => option.textContent?.includes(label));
    select.dispatchEvent(new Event('change'));
    select.dispatchEvent(new Event('blur'));
  }

  function submit(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  function optionLabels(element: HTMLElement, testId: string): string[] {
    return [...element.querySelectorAll(`[data-testid="${testId}"] option`)].map((option) => option.textContent!.trim());
  }

  it('offers the active account types by name and the three currencies', async () => {
    const { element } = await setup(null);

    expect(optionLabels(element, 'account-type')).toEqual(['Pick a type', 'Ahorros', 'Tarjeta de crédito']);
    expect(optionLabels(element, 'account-currency')).toEqual(['Colombian peso (COP)', 'US dollar (USD)', 'Euro (EUR)']);
    expect(element.querySelector<HTMLSelectElement>('[data-testid="account-currency"]')!.value).toContain('COP');
  });

  it('validates the fields locally before calling the backend', async () => {
    const { fixture, element } = await setup(null);

    type(element, 'account-name', 'x'.repeat(51));
    type(element, 'account-balance', '1.2345');
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('The name can be up to 50 characters.');
    expect(element.querySelector('[data-testid="type-error"]')?.textContent).toContain('Pick the account type.');
    expect(element.querySelector('[data-testid="balance-error"]')?.textContent).toContain('up to 3 decimals');
    expect(fake.lastDraft).toBeNull();
  });

  it('creates an account with a negative balance written with a comma', async () => {
    const { fixture, element } = await setup(null);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    type(element, 'account-name', '  Visa 4417 ');
    choose(element, 'account-type', 'Tarjeta de crédito');
    choose(element, 'account-currency', 'USD');
    type(element, 'account-balance', '-1250,5');
    submit(element);
    fixture.detectChanges();

    expect(fake.lastDraft).toEqual({ name: 'Visa 4417', accountTypeId: 3, currency: 'USD', initialBalance: -1250.5 });
    expect(navigate).toHaveBeenCalledWith(['/accounts'], { state: { notice: { kind: 'created', name: 'Visa 4417' } } });
  });

  it('shows a locked currency beside the currency field', async () => {
    const { fixture, element } = await setup('5');
    fake.failWith = new AccountError('The account already has transactions.', AccountErrorCode.CurrencyLocked);

    choose(element, 'account-currency', 'EUR');
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="currency-error"]')?.textContent).toContain(
      'The account already has transactions, so its currency cannot change.',
    );
    expect(element.querySelector('[data-testid="form-error"]')).toBeNull();
  });

  it('keeps a type that is no longer active selectable and explains the backend rejection', async () => {
    const { fixture, element } = await setup('5', () => {
      options.options = [{ id: 1, name: 'Ahorros' }];
    });
    fake.failWith = new AccountError('x', AccountErrorCode.TypeInvalid);

    expect(optionLabels(element, 'account-type')).toContain('Tarjeta de crédito');

    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="type-error"]')?.textContent).toContain('That account type is no longer available.');
  });

  it('points to the account types when there are none', async () => {
    const { element } = await setup(null, () => {
      options.options = [];
    });

    expect(element.querySelector('[data-testid="no-types"]')?.textContent).toContain('You have no active account types yet.');
    expect(element.querySelector('[data-testid="no-types"] a')?.getAttribute('href')).toBe('/account-types/new');
  });

  it('loads the account to edit', async () => {
    const { element } = await setup('5');

    expect(element.querySelector('h1')?.textContent).toContain('Edit account');
    expect(element.querySelector<HTMLInputElement>('[data-testid="account-name"]')?.value).toBe('Visa 4417');
    expect(element.querySelector<HTMLInputElement>('[data-testid="account-balance"]')?.value).toBe('-250000');
  });

  it('opens a deactivated account read-only', async () => {
    const { element } = await setup('8');

    expect(element.querySelector('[data-testid="account-read-only"]')?.textContent).toContain('This account is deactivated');
    expect(element.querySelector('[data-testid="account-read-only"]')?.textContent).toContain('$320.50');
    expect(element.querySelector('form')).toBeNull();
  });

  it('explains when the account does not exist', async () => {
    const { element } = await setup('404');

    expect(element.querySelector('[data-testid="account-not-found"]')?.textContent).toContain('Account unavailable');
  });
});
