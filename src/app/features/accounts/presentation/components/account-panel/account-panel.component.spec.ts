import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { Account } from '../../../domain/account';
import { AccountError, AccountErrorCode } from '../../../domain/account-error';
import { FakeAccountRepository, fakeAccountsRoutes } from '../../account-repository.fake';
import { AccountPanelComponent } from './account-panel.component';

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

  it('asks for name, currency, balance and opening date', async () => {
    const { element } = await open('/accounts/new');

    expect(element.querySelector('[data-testid="account-type"]')).toBeNull();
    expect(element.querySelector<HTMLInputElement>('[data-testid="currency-COP"]')!.checked).toBe(
      true,
    );
    expect(element.querySelector('[data-testid="currency-USD"]')).toBeTruthy();
    // EUR ya no se admite para cuentas nuevas.
    expect(element.querySelector('[data-testid="currency-EUR"]')).toBeNull();
    // La apertura llega prellenada con la hora actual.
    expect(
      element.querySelector<HTMLInputElement>('[data-testid="account-opening-time"]')!.value,
    ).toMatch(/^\d{2}:\d{2}$/);
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
      kind: 'standard',
      currency: 'USD',
      initialBalance: -1250.5,
      openingDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/),
      creditLimit: null,
      statementDay: null,
      paymentDay: null,
    });
    expect(new Date(fake.lastDraft!.openingDate).getTime()).toBeLessThanOrEqual(Date.now());
    expect(TestBed.inject(Router).url).toBe('/accounts');
    expect(element.querySelector('[data-testid="account-99"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="account-notice"]')?.textContent).toContain(
      'Visa 9000',
    );
  });

  it('shows a locked currency beside the currency field', async () => {
    const { harness, element } = await open('/accounts/2/edit');
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

  it('rejects an opening date later than now without calling the backend', async () => {
    const { harness, element } = await open('/accounts/new');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const isoDay = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    type(element, 'account-name', 'Futura');
    const panel = harness.fixture.debugElement.query(By.css('app-account-panel'));
    const day = (panel.componentInstance as AccountPanelComponent)['accountForm'].controls.openingDay;
    day.setValue(isoDay);
    day.markAsTouched();
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="opening-error"]')?.textContent).toContain(
      'The opening date cannot be later than now.',
    );
    expect(fake.lastDraft).toBeNull();
  });

  it('shows a backend opening date error beside the field', async () => {
    const { harness, element } = await open('/accounts/new');
    fake.failWith = new AccountError('Future', AccountErrorCode.OpeningDateFuture);

    type(element, 'account-name', 'Wise');
    submit(element);
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(element.querySelector('[data-testid="opening-error"]')?.textContent).toContain(
      'The opening date cannot be later than now.',
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
    const { harness, element } = await open('/accounts/2/edit');
    const panel = element.querySelector('[data-testid="account-panel"]')!;

    type(element, 'account-name', 'Visa nueva');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/accounts/2/edit');
  });

  it('opens a deactivated account read-only', async () => {
    const { element } = await open('/accounts/8/edit');

    const summary = element.querySelector('[data-testid="account-read-only"]')?.textContent;
    expect(summary).toContain('This account is deactivated');
    expect(summary).toContain('$320.50');
    expect(element.querySelector('[data-testid="account-opening"]')?.textContent).toContain('2026');
    expect(element.querySelector('h2')?.textContent).toContain('Wise');
    expect(element.querySelector('form')).toBeNull();
  });

  it('explains when the account does not exist', async () => {
    const { element } = await open('/accounts/404/edit');

    expect(element.querySelector('h2')?.textContent).toContain('Account unavailable');
    expect(element.querySelector('[data-testid="account-not-found"]')).toBeTruthy();
  });

  describe('an account with transactions', () => {
    function field(element: HTMLElement, testId: string): HTMLInputElement {
      return element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    }

    function expectIdentityEditable(element: HTMLElement): void {
      expect(field(element, 'account-name').disabled).toBe(false);
      expect(field(element, 'currency-COP').disabled).toBe(false);
      expect(field(element, 'currency-USD').disabled).toBe(false);
      expect(element.querySelector('[data-testid="account-locked"]')).toBeNull();
    }

    it('locks the name and the currency and explains why', async () => {
      const { element } = await open('/accounts/5/edit');

      expect(field(element, 'account-name').disabled).toBe(true);
      expect(field(element, 'account-name').value).toBe('Visa 4417');
      expect(field(element, 'currency-COP').disabled).toBe(true);
      expect(field(element, 'currency-COP').checked).toBe(true);
      expect(field(element, 'currency-USD').disabled).toBe(true);
      expect(element.querySelector('[data-testid="account-locked"]')?.textContent?.trim()).toBe(
        'This account already has transactions: its name, currency and type can no longer change.',
      );
      expect(field(element, 'account-name').getAttribute('aria-describedby')).toBe(
        'account-locked account-name-count',
      );
      // El saldo sigue siendo editable.
      expect(field(element, 'account-balance').disabled).toBe(false);
    });

    it('explains the lock in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open('/accounts/5/edit');

      expect(element.querySelector('[data-testid="account-locked"]')?.textContent?.trim()).toBe(
        'Esta cuenta ya tiene movimientos: su nombre, su moneda y su tipo no se pueden cambiar.',
      );
    });

    it('leaves an account without transactions editable', async () => {
      const { element } = await open('/accounts/2/edit');

      expectIdentityEditable(element);
      expect(field(element, 'account-name').getAttribute('aria-describedby')).toBe('account-name-count');
    });

    it('unlocks the fields when switching to an account without transactions', async () => {
      const { harness, element } = await open('/accounts/5/edit');

      await harness.navigateByUrl('/accounts/2/edit');

      expectIdentityEditable(element);
      expect(field(element, 'account-name').value).toBe('Bancolombia');
    });

    it('unlocks the fields when creating an account after editing a locked one', async () => {
      const { harness, element } = await open('/accounts/5/edit');

      await harness.navigateByUrl('/accounts/new');

      expectIdentityEditable(element);
      expect(field(element, 'account-name').value).toBe('');
    });

    it('sends the original name and currency when saving', async () => {
      const { harness, element } = await open('/accounts/5/edit');

      type(element, 'account-balance', '-300000');
      submit(element);
      await harness.fixture.whenStable();

      expect(fake.lastDraft).toEqual(
        expect.objectContaining({ name: 'Visa 4417', currency: 'COP', initialBalance: -300000 }),
      );
    });

    it('shows a locked name from the backend beside the name field', async () => {
      const { harness, element } = await open('/accounts/2/edit');
      fake.failWith = new AccountError(
        'The account already has transactions.',
        AccountErrorCode.NameLocked,
      );

      type(element, 'account-name', 'Bancolombia nueva');
      submit(element);
      harness.detectChanges();

      expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain(
        'The account already has transactions, so its name cannot change.',
      );
      expect(element.querySelector('[data-testid="form-error"]')).toBeNull();
    });
  });
  describe('a credit card', () => {
    /** Tarjeta con deuda, cupo y días de corte y pago. */
    const CARD: Account = {
      id: 9,
      name: 'Visa Oro',
      kind: 'credit_card',
      initialBalance: -150000,
      currentBalance: -150000,
      currency: 'COP',
      isActive: true,
      hasTransactions: false,
      openingDate: '2026-10-01T00:00:00Z',
      creditLimit: 2000000,
      statementDay: 15,
      paymentDay: 5,
      availableCredit: 1850000,
      nextStatementDate: '2026-11-15',
      nextPaymentDueDate: '2026-12-05',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: null,
    };

    /** Elige un día en el selector del campo (`account-statement-day` o `account-payment-day`). */
    async function pickDay(harness: RouterTestingHarness, element: HTMLElement, testId: string, day: number) {
      element.querySelector<HTMLElement>(`[data-testid="${testId}"] [data-testid="select-trigger"]`)!.click();
      harness.detectChanges();
      element.querySelector<HTMLElement>(`[data-testid="${testId}"] [data-testid="select-option-${day - 1}"]`)!.click();
      harness.detectChanges();
      await harness.fixture.whenStable();
    }

    async function chooseCard(harness: RouterTestingHarness, element: HTMLElement) {
      click(element, 'kind-credit_card');
      harness.detectChanges();
      await harness.fixture.whenStable();
    }

    it('shows the limit, the statement and payment days only for a card', async () => {
      const { harness, element } = await open('/accounts/new');

      expect(element.querySelector<HTMLInputElement>('[data-testid="kind-standard"]')!.checked).toBe(true);
      expect(element.querySelector('[data-testid="card-fields"]')).toBeNull();

      await chooseCard(harness, element);

      expect(element.querySelector('[data-testid="card-fields"]')).toBeTruthy();
      expect(element.querySelector('[data-testid="account-credit-limit"]')).toBeTruthy();
      expect(element.querySelector('[data-testid="account-statement-day"]')).toBeTruthy();
      expect(element.querySelector('[data-testid="account-payment-day"]')).toBeTruthy();
      expect(element.querySelector('label[for="account-balance"]')?.textContent).toContain('Current debt');
      expect(element.querySelector('[data-testid="account-submit"]')?.textContent).toContain('Create card');
      // Sin días elegidos no hay vista previa.
      expect(element.querySelector('[data-testid="card-preview"]')).toBeNull();

      click(element, 'kind-standard');
      harness.detectChanges();

      expect(element.querySelector('[data-testid="card-fields"]')).toBeNull();
    });

    it('previews the next statement and when to pay it', async () => {
      const { harness, element } = await open('/accounts/new');
      await chooseCard(harness, element);

      await pickDay(harness, element, 'account-statement-day', 15);
      await pickDay(harness, element, 'account-payment-day', 5);

      const preview = element.querySelector('[data-testid="card-preview"]')?.textContent ?? '';
      expect(preview).toContain('Next statement');
      expect(preview).toContain('Pay by');
      expect(preview).toContain('The payment falls in the month after the statement');
    });

    it('sends the debt written in positive as a negative opening balance', async () => {
      const { harness, element } = await open('/accounts/new');
      await chooseCard(harness, element);

      type(element, 'account-name', 'Visa Oro');
      type(element, 'account-balance', '150000,5');
      type(element, 'account-credit-limit', '2000000');
      await pickDay(harness, element, 'account-statement-day', 15);
      await pickDay(harness, element, 'account-payment-day', 5);
      submit(element);
      await harness.fixture.whenStable();

      expect(fake.lastDraft).toEqual(
        expect.objectContaining({
          name: 'Visa Oro',
          kind: 'credit_card',
          initialBalance: -150000.5,
          creditLimit: 2000000,
          statementDay: 15,
          paymentDay: 5,
        }),
      );
    });

    it('sends a zero debt as 0 and an empty limit as null', async () => {
      const { harness, element } = await open('/accounts/new');
      await chooseCard(harness, element);

      type(element, 'account-name', 'Sin deuda');
      await pickDay(harness, element, 'account-statement-day', 20);
      await pickDay(harness, element, 'account-payment-day', 28);
      submit(element);
      await harness.fixture.whenStable();

      expect(Object.is(fake.lastDraft?.initialBalance, 0)).toBe(true);
      expect(fake.lastDraft?.creditLimit).toBeNull();
    });

    it('validates the card fields before calling the backend', async () => {
      const { harness, element } = await open('/accounts/new');
      await chooseCard(harness, element);

      type(element, 'account-name', 'Visa');
      type(element, 'account-balance', '-100');
      type(element, 'account-credit-limit', '0');
      submit(element);
      harness.detectChanges();

      expect(element.querySelector('[data-testid="balance-error"]')?.textContent).toContain(
        'Enter the debt as a positive number',
      );
      expect(element.querySelector('[data-testid="credit-limit-error"]')?.textContent).toContain(
        'The credit limit must be greater than 0',
      );
      expect(element.querySelector('[data-testid="statement-day-error"]')?.textContent).toContain(
        "Pick the card's statement day.",
      );
      expect(element.querySelector('[data-testid="payment-day-error"]')?.textContent).toContain(
        "Pick the card's payment day.",
      );
      expect(fake.lastDraft).toBeNull();
    });

    it('does not send the card fields of a standard account', async () => {
      const { harness, element } = await open('/accounts/new');
      await chooseCard(harness, element);
      type(element, 'account-credit-limit', '5000');
      await pickDay(harness, element, 'account-statement-day', 15);

      click(element, 'kind-standard');
      harness.detectChanges();
      type(element, 'account-name', 'Ahorros');
      type(element, 'account-balance', '-20');
      submit(element);
      await harness.fixture.whenStable();

      expect(fake.lastDraft).toEqual(
        expect.objectContaining({
          kind: 'standard',
          initialBalance: -20,
          creditLimit: null,
          statementDay: null,
          paymentDay: null,
        }),
      );
    });

    it('shows the debt of a card in positive when editing', async () => {
      fake.accounts.push(CARD);
      const { element } = await open('/accounts/9/edit');

      expect(element.querySelector<HTMLInputElement>('[data-testid="kind-credit_card"]')!.checked).toBe(true);
      expect(element.querySelector<HTMLInputElement>('[data-testid="account-balance"]')!.value).toBe('150000');
      expect(element.querySelector<HTMLInputElement>('[data-testid="account-credit-limit"]')!.value).toBe('2000000');
      expect(element.querySelector('label[for="account-balance"]')?.textContent).toContain('Initial debt');
      expect(element.querySelector('[data-testid="account-statement-day"]')?.textContent).toContain('15');
      expect(element.querySelector('[data-testid="account-payment-day"]')?.textContent).toContain('5');
    });

    it('keeps the debt of a card negative when saving the edit', async () => {
      fake.accounts.push(CARD);
      const { harness, element } = await open('/accounts/9/edit');

      type(element, 'account-balance', '200000');
      submit(element);
      await harness.fixture.whenStable();

      expect(fake.lastDraft).toEqual(
        expect.objectContaining({ kind: 'credit_card', initialBalance: -200000, statementDay: 15, paymentDay: 5 }),
      );
    });

    it('locks the type when the account has transactions', async () => {
      fake.accounts.push({ ...CARD, hasTransactions: true });
      const { element } = await open('/accounts/9/edit');

      expect(element.querySelector<HTMLInputElement>('[data-testid="kind-credit_card"]')!.disabled).toBe(true);
      expect(element.querySelector<HTMLInputElement>('[data-testid="kind-standard"]')!.disabled).toBe(true);
      expect(element.textContent).toContain('The type can no longer change: the account has transactions.');
      // Los días siguen editables, con la nota de que solo afectan compras nuevas.
      expect(element.textContent).toContain('Changing the statement or payment day only affects new purchases.');
    });

    it('sends the locked type when saving', async () => {
      fake.accounts.push({ ...CARD, hasTransactions: true });
      const { harness, element } = await open('/accounts/9/edit');

      submit(element);
      await harness.fixture.whenStable();

      expect(fake.lastDraft?.kind).toBe('credit_card');
    });

    it('leaves the type editable for an account without transactions', async () => {
      const { element } = await open('/accounts/2/edit');

      expect(element.querySelector<HTMLInputElement>('[data-testid="kind-credit_card"]')!.disabled).toBe(false);
    });

    it.each([
      [AccountErrorCode.CardInitialBalancePositive, 'balance-error', "A card's debt can't start as a credit balance."],
      [AccountErrorCode.StatementDayRequired, 'statement-day-error', "Pick the card's statement day."],
      [AccountErrorCode.StatementDayInvalid, 'statement-day-error', 'The statement day must be between 1 and 31.'],
      [AccountErrorCode.PaymentDayRequired, 'payment-day-error', "Pick the card's payment day."],
      [AccountErrorCode.PaymentDayInvalid, 'payment-day-error', 'The payment day must be between 1 and 31.'],
      [AccountErrorCode.CreditLimitInvalid, 'credit-limit-error', 'The credit limit must be greater than 0.'],
      [AccountErrorCode.KindInvalid, 'kind-error', 'Choose whether it is a regular account or a credit card.'],
      [AccountErrorCode.KindLocked, 'kind-error', "The account already has transactions, so its type can't change."],
    ])('shows the backend %s beside its field', async (code, testId, copy) => {
      fake.accounts.push(CARD);
      const { harness, element } = await open('/accounts/9/edit');
      fake.failWith = new AccountError('Backend', code);

      submit(element);
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(element.querySelector(`[data-testid="${testId}"]`)?.textContent).toContain(copy);
      expect(element.querySelector('[data-testid="form-error"]')).toBeNull();
    });

    it('opens a deactivated card read-only with its debt in positive', async () => {
      fake.accounts.push({ ...CARD, isActive: false });
      const { element } = await open('/accounts/9/edit');

      const summary = element.querySelector('[data-testid="account-read-only"]')?.textContent ?? '';
      expect(summary).toContain('Initial debt');
      expect(summary).toContain('150,000');
      expect(summary).not.toContain('-');
    });
  });
});
