import { formatDate } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, firstValueFrom, of } from 'rxjs';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { FakePeriodRepository, periodYear, provideFakePeriods } from '@features/periods/testing';
import { HomePageComponent } from './home-page.component';
import { provideDashboard } from '../../../dashboard.providers';
import { DashboardError, DashboardErrorCode } from '../../../domain/dashboard-error';
import { DashboardOverview } from '../../../domain/dashboard-overview';
import { DashboardRepository } from '../../../domain/dashboard.repository';
import { CurrencyMonth, MonthSummary, SummaryMonth, monthKey, monthOfDay, todayInDashboardZone } from '../../../domain/month-summary';
import { MonthSummaryRepository } from '../../../domain/month-summary.repository';
import { monthOutlook } from '../../../domain/overview-insights';
import { InMemoryDashboardRepository } from '../../../infrastructure/in-memory-dashboard.repository';
import { FakeMonthSummaryRepository } from '../../month-summary-repository.fake';

/** El bloque principal pide el mes en curso en hora de Colombia: depende del reloj real. */
const TODAY = todayInDashboardZone();
const CURRENT: SummaryMonth = monthOfDay(TODAY);
const LAST_DAY = new Date(Date.UTC(CURRENT.year, CURRENT.month, 0)).getUTCDate();
const MONTH_END = `${monthKey(CURRENT)}-${String(LAST_DAY).padStart(2, '0')}`;

/** Lo que el bloque principal calcula para unas cifras del mes en curso. */
function outlookOf(figures: CurrencyMonth) {
  return monthOutlook({
    month: monthKey(CURRENT),
    asOf: TODAY,
    income: figures.income,
    expenses: figures.spent,
    committed: figures.committed,
  });
}

/** Resumen del mes en curso con las monedas dadas. */
function summaryWith(...currencies: CurrencyMonth[]): MonthSummary {
  return { ...CURRENT, currencies };
}

function cop(overrides: Partial<CurrencyMonth> = {}): CurrencyMonth {
  return { currency: 'COP', income: 6_200_000, incomePayments: 3, spent: 2_360_000, committed: 1_000_000, ...overrides };
}

interface Setup {
  overview?: Partial<DashboardOverview>;
  periods?: FakePeriodRepository;
  summaries?: MonthSummaryRepository;
}

async function setup({ overview = {}, periods = new FakePeriodRepository(), summaries }: Setup = {}) {
  const sample = await firstValueFrom(new InMemoryDashboardRepository().overview());
  const fake = new FakeMonthSummaryRepository();

  await TestBed.configureTestingModule({
    imports: [HomePageComponent, translocoTesting()],
    providers: [
      provideRouter([{ path: '', component: HomePageComponent }]),
      provideDashboard(),
      provideFakePeriods(periods),
      { provide: DashboardRepository, useValue: { overview: () => of({ ...sample, ...overview }) } },
      { provide: MonthSummaryRepository, useValue: summaries ?? fake },
    ],
  }).compileComponents();

  return fake;
}

/** Fija la respuesta del mes en curso en el repositorio falso. */
async function setupWith(summary: MonthSummary): Promise<FakeMonthSummaryRepository> {
  const fake = new FakeMonthSummaryRepository();
  fake.summaries[monthKey(CURRENT)] = summary;
  await setup({ summaries: fake });

  return fake;
}

function render() {
  const fixture = TestBed.createComponent(HomePageComponent);
  fixture.detectChanges();

  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function text(element: HTMLElement, testId: string): string {
  return element.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Segmentos de la barra del reparto y textos de su leyenda. */
function split(element: HTMLElement) {
  const bar = element.querySelector('[data-testid="hero-split"]')!;
  const legend = [...(bar.parentElement?.querySelectorAll('ul li') ?? [])].map((item) => item.textContent!.replace(/\s+/g, ' ').trim());

  return { bar, segments: bar.querySelectorAll('span').length, legend };
}

describe('HomePageComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('with the sample month', () => {
    let fake: FakeMonthSummaryRepository;

    beforeEach(async () => {
      fake = await setup();
    });

    it('asks the backend for the current month in Colombian time', () => {
      render();

      expect(fake.requested).toEqual([CURRENT]);
    });

    it('leads with what is available to spend until the end of the month', () => {
      const { element } = render();

      expect(text(element, 'available')).toBe('$2,840,000');
      expect(text(element, 'available-currency')).toBe('COP');
      expect(text(element, 'hero')).toContain(`Available to spend until ${formatDate(`${MONTH_END}T00:00:00`, 'MMMM d', 'en-US')}`);
      expect(text(element, 'hero-summary')).toBe(
        "You received $6,200,000 in 3 payments this month. You've spent $2,360,000 and have $1,000,000 committed to your budget limits.",
      );
    });

    it('splits the income into spent, committed and available', () => {
      const { element } = render();
      const { bar, segments, legend } = split(element);

      expect(segments).toBe(3);
      expect(bar.getAttribute('role')).toBe('img');
      expect(bar.getAttribute('aria-label')).toBe("This month's income: 38.1% spent, 16.1% committed and 45.8% available");
      expect(legend).toEqual(['Spent 38.1%', 'Committed 16.1%', 'Available 45.8%']);
    });

    it('spreads what is available over the days left', () => {
      const { element } = render();
      const { daysLeft } = outlookOf(cop());

      if (daysLeft === 0) {
        expect(element.querySelector('[data-testid="per-day"]')).toBeNull();
      } else if (daysLeft === 1) {
        expect(text(element, 'per-day')).toContain('for the last day of the month');
      } else {
        expect(text(element, 'per-day')).toContain(`for the next ${daysLeft} days`);
      }
    });

    it('shows how long the savings last against the goal', () => {
      const { element } = render();

      expect(text(element, 'cushion')).toContain('2.4 months');
      expect(text(element, 'cushion')).toContain('Goal: 6 months');
      expect(element.querySelectorAll('[data-testid="cushion"] [role="img"] > span').length).toBe(6);
    });

    it('compares the month with the average of the previous months', () => {
      const { element } = render();

      expect(text(element, 'stat-income')).toContain('18.3% above your 5-month average');
      expect(text(element, 'stat-expenses')).toContain('60.8% of your average, 11 days before month end');
      expect(text(element, 'stat-savings')).toContain('45.8%');
      expect(text(element, 'stat-savings')).toContain('Above your 30% goal');
    });

    it('groups the recent movements by day', () => {
      const { element } = render();
      const days = element.querySelectorAll('[data-testid="movement-day"]');

      expect(days.length).toBe(3);
      expect(days[0].querySelector('h3')?.textContent).toContain('Today');
      expect(days[1].querySelector('h3')?.textContent).toContain('Yesterday');
      expect(days[0].querySelectorAll('li').length).toBe(2);
    });

    it('draws a pair of bars per month and the income average', () => {
      const { element } = render();

      expect(element.querySelectorAll('app-cash-flow-chart svg rect').length).toBe(12);
      expect(element.querySelector('app-cash-flow-chart line[stroke-dasharray]')).toBeTruthy();
    });

    it('masks every amount on demand', () => {
      const { fixture, element } = render();
      const toggle = element.querySelector('[data-testid="toggle-amounts"]') as HTMLButtonElement;

      toggle.click();
      fixture.detectChanges();

      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(text(element, 'available')).toBe('•••••');
      expect(text(element, 'hero-summary')).toBe(
        "You received ••••• in 3 payments this month. You've spent ••••• and have ••••• committed to your budget limits.",
      );
      if (element.querySelector('[data-testid="per-day"]')) {
        expect(text(element, 'per-day')).toContain('•••••');
        expect(text(element, 'per-day')).not.toContain('$');
      }
      expect(element.textContent).not.toContain('6,200,000');
      expect(element.textContent).not.toContain('2,840,000');
      expect(element.textContent).not.toContain('3,200,000');
      expect(toggle.textContent).toContain('Show amounts');
    });

    it('translates the view into Spanish', () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toContain('Resumen');
      expect(text(element, 'hero')).toContain(
        `Disponible para gastar hasta el ${formatDate(`${MONTH_END}T00:00:00`, "d 'de' MMMM", 'es-CO')}`,
      );
      expect(text(element, 'hero-summary')).toContain('comprometido en tus topes del presupuesto');
      expect(element.textContent).toContain('Flujo de caja');
      expect(element.textContent).toContain('Vivienda');
    });
  });

  describe('while the month is loading', () => {
    it('says it is working it out', async () => {
      const pending = new Subject<MonthSummary>();
      const requested: SummaryMonth[] = [];
      await setup({
        summaries: {
          summary: (month: SummaryMonth) => {
            requested.push(month);
            return pending;
          },
        } as MonthSummaryRepository,
      });
      const { fixture, element } = render();

      expect(requested).toEqual([CURRENT]);
      expect(element.querySelector('[data-testid="hero-loading"]')?.getAttribute('role')).toBe('status');
      expect(text(element, 'hero-loading')).toBe("Working out what's available this month…");
      // El esqueleto es visual; el texto queda solo para lectores de pantalla.
      expect(element.querySelector('[data-testid="hero-loading"] .sr-only')?.textContent?.trim()).toBe(
        "Working out what's available this month…",
      );
      expect(element.querySelector('[data-testid="available"]')).toBeNull();

      pending.next(summaryWith(cop()));
      fixture.detectChanges();

      expect(element.querySelector('[data-testid="hero-loading"]')).toBeNull();
      expect(text(element, 'available')).toBe('$2,840,000');
    });
  });

  describe('without anything committed', () => {
    beforeEach(() => setupWith(summaryWith(cop({ income: 5_000_000, incomePayments: 2, spent: 1_000_000, committed: 0 }))));

    it('leaves the committed part out of the sentence and the split', () => {
      const { element } = render();
      const { bar, segments, legend } = split(element);

      expect(text(element, 'available')).toBe('$4,000,000');
      expect(text(element, 'hero-summary')).toBe("You received $5,000,000 in 2 payments this month and you've spent $1,000,000.");
      expect(segments).toBe(2);
      expect(bar.getAttribute('aria-label')).toBe("This month's income: 20% spent and 80% available");
      expect(legend).toEqual(['Spent 20%', 'Available 80%']);
    });
  });

  describe('with a single income payment', () => {
    it('says it came in one payment', async () => {
      await setupWith(summaryWith(cop({ incomePayments: 1 })));
      const { element } = render();

      expect(text(element, 'hero-summary')).toContain('You received $6,200,000 in one payment this month.');
      expect(text(element, 'hero-summary')).toContain('committed to your budget limits');
    });

    it('says it came in one payment without anything committed', async () => {
      await setupWith(summaryWith(cop({ incomePayments: 1, committed: 0 })));
      const { element } = render();

      expect(text(element, 'hero-summary')).toBe("You received $6,200,000 in one payment this month and you've spent $2,360,000.");
    });
  });

  describe('when the month is overspent', () => {
    it('says so calmly and drops the daily amount', async () => {
      // Lo gastado ya supera lo recibido.
      await setupWith(summaryWith(cop({ income: 3_000_000, incomePayments: 1, spent: 3_200_000, committed: 400_000 })));
      const { element } = render();

      expect(text(element, 'hero')).toContain("This month you've used more than you received");
      expect(text(element, 'hero')).not.toContain('Available to spend until');
      expect(text(element, 'hero')).not.toContain("This month's limits add up to more than you received");
      expect(text(element, 'hero-summary')).toContain("What you've spent plus what's committed to your limits is $600,000 more");
      expect(element.querySelector('[data-testid="per-day"]')).toBeNull();
    });

    it('shows the big negative amount with a typographic minus sign', async () => {
      await setupWith(summaryWith(cop({ income: 3_000_000, incomePayments: 1, spent: 3_200_000, committed: 400_000 })));
      const { element } = render();

      expect(text(element, 'available')).toBe('−$600,000');
      expect(text(element, 'available')).not.toContain('-');
    });

    it('leaves the empty available part out of the split', async () => {
      await setupWith(summaryWith(cop({ income: 3_000_000, incomePayments: 1, spent: 3_200_000, committed: 400_000 })));
      const { element } = render();
      const { segments, legend } = split(element);

      expect(segments).toBe(2);
      expect(legend.map((item) => item.split(' ')[0])).toEqual(['Spent', 'Committed']);
      expect(legend.join(' ')).not.toContain('Available');
    });

    it('treats spending without income as overspent', async () => {
      await setupWith(summaryWith(cop({ income: 0, incomePayments: 0, spent: 50_000, committed: 0 })));
      const { element } = render();

      expect(element.querySelector('[data-testid="hero-empty"]')).toBeNull();
      expect(text(element, 'hero')).toContain("This month you've used more than you received");
      expect(text(element, 'hero-summary')).toContain('$50,000 more than what came in');
      expect(element.querySelector('[data-testid="per-day"]')).toBeNull();
    });
  });

  describe('when the limits add up to more than the income', () => {
    it('warns about the limits while spending is still within the income', async () => {
      await setupWith(summaryWith(cop({ income: 1_000_000, incomePayments: 1, spent: 800_000, committed: 500_000 })));
      const { element } = render();

      expect(text(element, 'hero')).toContain("This month's limits add up to more than you received");
      expect(text(element, 'hero')).not.toContain("This month you've used more than you received");
      expect(text(element, 'hero')).not.toContain('Available to spend until');
      expect(text(element, 'hero-summary')).toBe(
        "If you spend what's left of your limits, you'd go over by $300,000. Check which budget limits you can adjust.",
      );
      expect(element.querySelector('[data-testid="per-day"]')).toBeNull();
    });

    it('treats limits without income or spending as overplanned', async () => {
      await setupWith(summaryWith({ currency: 'USD', income: 0, incomePayments: 0, spent: 0, committed: 20 }));
      const { element } = render();

      expect(element.querySelector('[data-testid="hero-empty"]')).toBeNull();
      expect(text(element, 'available-currency')).toBe('USD');
      expect(text(element, 'hero')).toContain("This month's limits add up to more than you received");
      expect(text(element, 'hero-summary')).toContain("you'd go over by $20.");
      expect(element.querySelector('[data-testid="per-day"]')).toBeNull();
      // Sin ingreso no hay nada que repartir.
      expect(element.querySelector('[data-testid="hero-split"]')).toBeNull();
    });

    it('treats spending equal to the income as overplanned', async () => {
      await setupWith(summaryWith(cop({ income: 1_000_000, incomePayments: 1, spent: 1_000_000, committed: 100_000 })));
      const { element } = render();

      expect(text(element, 'hero')).toContain("This month's limits add up to more than you received");
      expect(text(element, 'hero-summary')).toContain("you'd go over by $100,000.");
    });

    it('translates the warning into Spanish', async () => {
      await setupWith(summaryWith(cop({ income: 1_000_000, incomePayments: 1, spent: 800_000, committed: 500_000 })));
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = render();

      expect(text(element, 'hero')).toContain('Tus topes del mes superan lo que recibiste');
      expect(text(element, 'hero-summary')).toMatch(
        /^Si gastas lo que falta de tus topes, te pasarías por .*300\.000\. Revisa qué topes del presupuesto puedes ajustar\.$/,
      );
    });
  });

  describe('with an empty month', () => {
    it('invites to record the first income when there are no currencies', async () => {
      await setupWith(summaryWith());
      const { element } = render();

      expect(text(element, 'hero-empty')).toContain('You have no income, spending or limits this month yet.');
      expect(element.querySelector('[data-testid="hero-add-income"]')?.getAttribute('href')).toBe('/transactions/new/income');
      expect(element.querySelector('[data-testid="available"]')).toBeNull();
      expect(element.querySelector('[data-testid="summary-currency"]')).toBeNull();
    });

    it('treats a currency with every figure in zero as empty', async () => {
      await setupWith(summaryWith(cop({ income: 0, incomePayments: 0, spent: 0, committed: 0 })));
      const { element } = render();

      expect(element.querySelector('[data-testid="hero-empty"]')).toBeTruthy();
      expect(element.querySelector('[data-testid="hero-split"]')).toBeNull();
    });
  });

  describe('when the month fails to load', () => {
    it('shows the error and retries on demand', async () => {
      const fake = new FakeMonthSummaryRepository();
      fake.failWith = new DashboardError('That month is not valid.', DashboardErrorCode.PeriodInvalid);
      await setup({ summaries: fake });
      const { fixture, element } = render();

      const error = element.querySelector('[data-testid="hero-error"]');
      expect(error?.getAttribute('role')).toBe('alert');
      expect(text(element, 'hero-error')).toContain("We couldn't work out what's available this month.");
      expect(text(element, 'hero-error')).toContain('That month is not valid.');
      expect(element.querySelector('[data-testid="available"]')).toBeNull();

      element.querySelector<HTMLButtonElement>('[data-testid="hero-retry"]')!.click();
      fixture.detectChanges();

      expect(fake.requested).toEqual([CURRENT, CURRENT]);
      expect(element.querySelector('[data-testid="hero-error"]')).toBeNull();
      expect(text(element, 'available')).toBe('$2,840,000');
    });
  });

  describe('with several currencies', () => {
    const usd: CurrencyMonth = { currency: 'USD', income: 1_200.5, incomePayments: 1, spent: 300, committed: 0 };

    beforeEach(() => setupWith(summaryWith(usd, cop())));

    async function open(url = '/') {
      const harness = await RouterTestingHarness.create(url);
      await settle(harness);

      return { harness, element: harness.routeNativeElement as HTMLElement };
    }

    async function settle(harness: RouterTestingHarness): Promise<void> {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    function options(element: HTMLElement, harness: RouterTestingHarness): HTMLElement[] {
      element.querySelector<HTMLElement>('[data-testid="summary-currency"] [data-testid="select-trigger"]')!.click();
      harness.detectChanges();

      return [...element.querySelectorAll<HTMLElement>('[data-testid="summary-currency"] [role="option"]')];
    }

    async function choose(element: HTMLElement, harness: RouterTestingHarness, code: string): Promise<void> {
      options(element, harness)
        .find((option) => option.textContent?.includes(code))!
        .click();
      await settle(harness);
    }

    it('offers a currency selector with pesos first', async () => {
      const { harness, element } = await open();

      expect(element.querySelector('label[for="summary-currency"]')?.textContent?.trim()).toBe('Currency');
      expect(element.querySelector('#summary-currency')).toBeTruthy();
      expect(options(element, harness).map((option) => option.textContent!.trim())).toEqual([
        'Colombian pesos · COP',
        'US dollars · USD',
      ]);
      expect(text(element, 'available-currency')).toBe('COP');
    });

    it('switches the amounts through ?currency= and back', async () => {
      const { harness, element } = await open();
      const router = TestBed.inject(Router);

      await choose(element, harness, 'USD');

      expect(router.url).toBe('/?currency=USD');
      expect(text(element, 'available-currency')).toBe('USD');
      expect(text(element, 'available')).toBe('$900.50');
      expect(text(element, 'hero-summary')).toBe("You received $1,200.50 in one payment this month and you've spent $300.");

      await choose(element, harness, 'COP');

      expect(router.url).toBe('/');
      expect(text(element, 'available')).toBe('$2,840,000');
    });

    it('opens in the currency of the URL', async () => {
      const { element } = await open('/?currency=USD');

      expect(text(element, 'available-currency')).toBe('USD');
      expect(text(element, 'available')).toBe('$900.50');
    });

    it('falls back to pesos for a currency the month does not have', async () => {
      const { element } = await open('/?currency=EUR');

      expect(text(element, 'available-currency')).toBe('COP');
      expect(text(element, 'available')).toBe('$2,840,000');
    });
  });

  describe('with dollars in whole amounts', () => {
    it('shows no decimals when the amounts are whole', async () => {
      await setupWith(summaryWith({ currency: 'USD', income: 1_200, incomePayments: 1, spent: 300, committed: 0 }));
      const { element } = render();

      expect(text(element, 'available')).toBe('$900');
      expect(text(element, 'hero-summary')).toBe("You received $1,200 in one payment this month and you've spent $300.");
    });
  });

  describe('at the start of the month without spending', () => {
    it('leaves the empty spent part out of the split', async () => {
      await setupWith(summaryWith(cop({ spent: 0 })));
      const { element } = render();
      const { segments, legend } = split(element);

      expect(segments).toBe(2);
      expect(legend.map((item) => item.split(' ')[0])).toEqual(['Committed', 'Available']);
      expect(legend.join(' ')).not.toContain('Spent');
    });
  });

  describe('with a single currency', () => {
    it('shows no currency selector', async () => {
      await setupWith(summaryWith(cop()));
      const { element } = render();

      expect(element.querySelector('[data-testid="summary-currency"]')).toBeNull();
      expect(text(element, 'available-currency')).toBe('COP');
    });
  });

  describe('without previous months', () => {
    beforeEach(() => setup({ overview: { cashFlow: [{ month: '2026-10', income: 6_200_000, expenses: 2_360_000 }] } }));

    it('explains that there is nothing to compare yet', () => {
      const { element } = render();

      expect(text(element, 'stat-income')).toContain('No earlier months to compare yet');
      expect(text(element, 'cushion')).toContain('Once you have earlier months recorded');
    });
  });

  describe('with the period closing', () => {
    it('shows the month selector and proposes closing the month that ended', async () => {
      const periods = new FakePeriodRepository();
      periods.pendingPeriod = { year: 2026, month: 10, endedOn: '2026-10-31', autoCloseOn: null, canClose: true };
      await setup({ periods });
      const { fixture, element } = render();

      expect(element.querySelector('[data-testid="period-selector"]')).toBeTruthy();
      expect(text(element, 'period-banner')).toContain('October is over. Close it?');

      element.querySelector<HTMLButtonElement>('[data-testid="period-banner-review"]')!.click();
      fixture.detectChanges();

      expect(periods.calls).toContain('review 2026-10');
    });

    it('marks the days of a closed month', async () => {
      const periods = new FakePeriodRepository();
      periods.years[2026] = periodYear(2026, Array(10).fill('closed').concat(['current']));
      await setup({ periods });
      const { element } = render();

      expect(element.querySelectorAll('[data-testid="movement-day"] [data-testid="closed-month-badge"]').length).toBe(3);
    });

    it('does not mark the days while their month is open', async () => {
      await setup();
      const { element } = render();

      expect(element.querySelector('[data-testid="closed-month-badge"]')).toBeNull();
      expect(element.querySelector('[data-testid="period-banner"]')).toBeNull();
    });
  });
});
