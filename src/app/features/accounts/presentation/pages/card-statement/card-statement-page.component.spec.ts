import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { Account } from '../../../domain/account';
import { AccountError, AccountErrorCode } from '../../../domain/account-error';
import { CardStatement } from '../../../domain/card-statement';
import { FakeAccountRepository, fakeAccountsRoutes } from '../../account-repository.fake';

/** Tarjeta activa con deuda, en pesos. */
const CARD: Account = {
  id: 9,
  name: 'Visa Oro',
  kind: 'credit_card',
  initialBalance: -150000,
  currentBalance: -400000,
  currency: 'COP',
  isActive: true,
  hasTransactions: true,
  openingDate: '2026-09-01T00:00:00Z',
  creditLimit: 2000000,
  statementDay: 15,
  paymentDay: 5,
  availableCredit: 1600000,
  nextStatementDate: '2026-11-15',
  nextPaymentDueDate: '2026-12-05',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: null,
};

/** Extracto vencido parcialmente: saldo anterior, dos cuotas y un pago repartido. */
const STATEMENT: CardStatement = {
  accountId: 9,
  month: { year: 2026, month: 10 },
  statementDay: 15,
  periodStart: '2026-09-16',
  periodEnd: '2026-10-15',
  paymentDueDate: '2026-11-05',
  total: 251500,
  paymentsTotal: 100000,
  balanceDue: 151500,
  status: 'partial',
  openingDebt: 150000,
  items: [
    {
      transactionId: 41,
      description: 'Televisor',
      categoryName: 'Hogar',
      purchaseDate: '2026-09-20',
      number: 2,
      installments: 6,
      principal: 50000,
      interest: 1500,
      amount: 51500,
    },
    {
      transactionId: 42,
      description: null,
      categoryName: null,
      purchaseDate: '2026-10-02',
      number: 1,
      installments: 1,
      principal: 50000,
      interest: 0,
      amount: 50000,
    },
  ],
  payments: [
    {
      transactionId: 70,
      date: '2026-10-28T15:00:00Z',
      fromAccountId: 2,
      fromAccountName: 'Bancolombia',
      paymentAmount: 300000,
      appliedAmount: 100000,
    },
    {
      transactionId: 71,
      date: '2026-10-30T15:00:00Z',
      fromAccountId: 2,
      fromAccountName: 'Nequi',
      paymentAmount: 20000,
      appliedAmount: 20000,
    },
  ],
  previous: { year: 2026, month: 9 },
  next: null,
};

describe('CardStatementPageComponent', () => {
  let fake: FakeAccountRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeAccountRepository();
    fake.accounts.push(CARD);
    fake.statementResult = STATEMENT;
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter([...fakeAccountsRoutes(fake), { path: '**', children: [] }])],
    }).compileComponents();
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  function byTestId(element: HTMLElement, testId: string): HTMLElement | null {
    return element.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  }

  it('asks for the next statement when the URL has no month', async () => {
    await open('/accounts/9/statement');

    expect(fake.lastStatementMonth).toBeUndefined();
  });

  it('asks for the month of the URL and ignores a malformed one', async () => {
    const { harness } = await open('/accounts/9/statement?month=2026-10');
    expect(fake.lastStatementMonth).toEqual({ year: 2026, month: 10 });

    await harness.navigateByUrl('/accounts/9/statement?month=2026-13');
    expect(fake.lastStatementMonth).toBeUndefined();
  });

  it('shows the status, the amounts and the installments of the statement', async () => {
    const { element } = await open('/accounts/9/statement?month=2026-10');

    expect(element.querySelector('h1')?.textContent).toContain('Visa Oro statement');
    expect(byTestId(element, 'statement-month')?.textContent).toContain('October 2026');
    expect(byTestId(element, 'statement-balance-due')?.textContent).toContain('151,500');
    expect(byTestId(element, 'statement-status')?.textContent).toContain('Partly paid');
    expect(byTestId(element, 'statement-total')?.textContent).toContain('251,500');
    expect(byTestId(element, 'statement-paid')?.textContent).toContain('100,000');

    const items = byTestId(element, 'statement-items')!;
    expect(items.textContent).toContain('Televisor');
    expect(items.textContent).toContain('2 of 6');
    expect(items.textContent).toContain('No description');
    expect(items.querySelector('a[href="/transactions/41"]')).toBeTruthy();
    expect(byTestId(element, 'statement-empty')).toBeNull();
  });

  it('shows the previous balance only on the statement that has it', async () => {
    const { harness, element } = await open('/accounts/9/statement?month=2026-10');
    expect(byTestId(element, 'statement-opening-debt')?.textContent).toContain('Previous balance');

    fake.statementResult = { ...STATEMENT, openingDebt: 0 };
    await harness.navigateByUrl('/accounts/9/statement?month=2026-09');
    expect(byTestId(element, 'statement-opening-debt')).toBeNull();
  });

  it('shows the previous balance in Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open('/accounts/9/statement?month=2026-10');

    expect(byTestId(element, 'statement-opening-debt')?.textContent).toContain('Saldo anterior');
  });

  it('shows an empty statement when it has no purchases nor previous balance', async () => {
    fake.statementResult = { ...STATEMENT, items: [], openingDebt: 0 };
    const { element } = await open('/accounts/9/statement');

    expect(byTestId(element, 'statement-empty')?.textContent).toContain('This statement has no purchases.');
    expect(byTestId(element, 'statement-items')).toBeNull();
  });

  it('lists the payments and says when only part of a payment went to this statement', async () => {
    const { element } = await open('/accounts/9/statement?month=2026-10');
    const [split, whole] = [...byTestId(element, 'statement-payments')!.querySelectorAll('li')].map(
      (item) => item.textContent ?? '',
    );

    expect(split).toContain('Transfer from Bancolombia');
    expect(split).toContain('(from a COP300,000 payment)');
    expect(split).toContain('100,000');
    expect(whole).toContain('Transfer from Nequi');
    expect(whole).not.toContain('from a');
  });

  it('hides the payments when there are none', async () => {
    fake.statementResult = { ...STATEMENT, payments: [] };
    const { element } = await open('/accounts/9/statement');

    expect(byTestId(element, 'statement-payments')).toBeNull();
  });

  it('enables the arrows according to the neighbor statements', async () => {
    const { harness, element } = await open('/accounts/9/statement?month=2026-10');

    expect((byTestId(element, 'statement-previous') as HTMLButtonElement).disabled).toBe(false);
    expect((byTestId(element, 'statement-next') as HTMLButtonElement).disabled).toBe(true);

    fake.statementResult = { ...STATEMENT, previous: null, next: { year: 2026, month: 11 } };
    await harness.navigateByUrl('/accounts/9/statement?month=2026-09');

    expect((byTestId(element, 'statement-previous') as HTMLButtonElement).disabled).toBe(true);
    expect((byTestId(element, 'statement-next') as HTMLButtonElement).disabled).toBe(false);
  });

  it('moves to another month with ?month=', async () => {
    fake.statementResult = { ...STATEMENT, next: { year: 2026, month: 11 } };
    const { harness, element } = await open('/accounts/9/statement?month=2026-10');

    byTestId(element, 'statement-previous')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/accounts/9/statement?month=2026-09');
    expect(fake.lastStatementMonth).toEqual({ year: 2026, month: 9 });

    byTestId(element, 'statement-next')!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/accounts/9/statement?month=2026-11');
    expect(fake.lastStatementMonth).toEqual({ year: 2026, month: 11 });
  });

  it('links the payment to the transfer form with the card, the month and the amount due', async () => {
    const { element } = await open('/accounts/9/statement?month=2026-10');
    const pay = byTestId(element, 'statement-pay')!;

    expect(pay.textContent).toContain('Pay COP151,500');
    const url = new URL(pay.getAttribute('href')!, 'http://localhost');
    expect(url.pathname).toBe('/transactions/new/transfer');
    expect(url.searchParams.get('payCard')).toBe('9');
    expect(url.searchParams.get('statement')).toBe('2026-10');
    expect(url.searchParams.get('due')).toBe('151500');
  });

  it('does not offer to pay a statement with nothing due', async () => {
    fake.statementResult = { ...STATEMENT, balanceDue: 0, status: 'paid' };
    const { element } = await open('/accounts/9/statement');

    expect(byTestId(element, 'statement-pay')).toBeNull();
    expect(byTestId(element, 'statement-status')?.textContent).toContain('Paid');
  });

  it('does not offer to pay from a deactivated card', async () => {
    fake.accounts = fake.accounts.map((account) => (account.id === 9 ? { ...account, isActive: false } : account));
    const { element } = await open('/accounts/9/statement');

    expect(byTestId(element, 'statement-summary')).toBeTruthy();
    expect(byTestId(element, 'statement-pay')).toBeNull();
  });

  it('says when an open statement has not closed yet', async () => {
    fake.statementResult = { ...STATEMENT, status: 'open' };
    const { element } = await open('/accounts/9/statement');

    expect(element.textContent).toContain("This statement hasn't closed yet");
  });

  it('treats an account that is not a card as not found', async () => {
    const { element } = await open('/accounts/2/statement');

    expect(byTestId(element, 'statement-not-found')).toBeTruthy();
    expect(fake.lastStatementMonth).toBeUndefined();
  });

  it('treats a missing account as not found', async () => {
    const { element } = await open('/accounts/404/statement');

    expect(byTestId(element, 'statement-not-found')?.textContent).toContain('Statement not available');
  });

  it('treats ACCOUNT_NOT_CREDIT_CARD from the statement as not found', async () => {
    const statement = fake.statement.bind(fake);
    fake.statement = (id, month) => {
      fake.failWith = new AccountError('Not a card', AccountErrorCode.NotCreditCard);
      return statement(id, month);
    };
    const { element } = await open('/accounts/9/statement');

    expect(byTestId(element, 'statement-not-found')).toBeTruthy();
  });

  it('shows any other error with a retry', async () => {
    const statement = fake.statement.bind(fake);
    let fail = true;
    fake.statement = (id, month) => {
      if (fail) {
        fake.failWith = new AccountError('Server down');
        fail = false;
      }
      return statement(id, month);
    };
    const { harness, element } = await open('/accounts/9/statement');

    expect(byTestId(element, 'load-error')?.textContent).toContain('Server down');

    byTestId(element, 'retry')!.click();
    harness.detectChanges();

    expect(byTestId(element, 'statement-summary')).toBeTruthy();
  });
  describe('an upcoming statement', () => {
    const UPCOMING: CardStatement = {
      ...STATEMENT,
      month: { year: 2026, month: 12 },
      periodStart: '2026-11-16',
      periodEnd: '2026-12-15',
      paymentDueDate: '2027-01-05',
      status: 'upcoming',
      openingDebt: 0,
      paymentsTotal: 0,
      payments: [],
      balanceDue: 101500,
    };

    it('shows when its cycle starts and does not offer to pay it', async () => {
      fake.statementResult = UPCOMING;
      const { element } = await open('/accounts/9/statement?month=2026-12');

      expect(byTestId(element, 'statement-status')?.textContent).toContain('Upcoming · starts Nov 16');
      expect(byTestId(element, 'statement-pay')).toBeNull();
      const note = byTestId(element, 'statement-upcoming-note')?.textContent ?? '';
      expect(note).toContain("This statement hasn't started yet: its cycle begins November 16");
      expect(note).toContain('by January 5');
      expect(element.textContent).not.toContain("This statement hasn't closed yet");
    });

    it('has no upcoming note on other statements', async () => {
      const { element } = await open('/accounts/9/statement?month=2026-10');

      expect(byTestId(element, 'statement-upcoming-note')).toBeNull();
    });

    it('translates it into Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      fake.statementResult = UPCOMING;
      const { element } = await open('/accounts/9/statement?month=2026-12');

      expect(byTestId(element, 'statement-status')?.textContent).toContain('Próximo · empieza el 16 nov');
      const note = byTestId(element, 'statement-upcoming-note')?.textContent ?? '';
      expect(note).toContain('Este extracto aún no empieza: su ciclo arranca el 16 de noviembre');
      expect(note).toContain('hasta el 5 de enero');
    });
  });
  describe('dates with the month in words', () => {
    it('writes the period, the due date and the payments in English', async () => {
      const { element } = await open('/accounts/9/statement?month=2026-10');

      expect(element.textContent).toContain('Sep 16 – Oct 15, 2026 · closes on day 15');
      expect(byTestId(element, 'statement-due-date')?.textContent?.trim()).toBe('Nov 5, 2026');
      expect(byTestId(element, 'statement-payments')?.textContent).toContain('on Oct 28, 2026');
    });

    it('writes them in Spanish without numeric dates', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open('/accounts/9/statement?month=2026-10');

      expect(byTestId(element, 'statement-due-date')?.textContent?.trim()).toBe('5 nov 2026');
      expect(element.textContent).toContain('15 oct 2026');
      expect(element.textContent).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it('writes the day of the cut inside the open note', async () => {
      fake.statementResult = { ...STATEMENT, status: 'open' };
      const { element } = await open('/accounts/9/statement');

      expect(element.textContent).toContain('purchases you make through October 15 are added here');
    });

    it('writes the day of the cut inside the open note in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      fake.statementResult = { ...STATEMENT, status: 'open' };
      const { element } = await open('/accounts/9/statement');

      expect(element.textContent).toContain('15 de octubre');
    });
  });
});
