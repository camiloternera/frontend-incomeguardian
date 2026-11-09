import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { FakePeriodRepository, periodYear, provideFakePeriods } from '@features/periods/testing';
import { HomePageComponent } from './home-page.component';
import { provideDashboard } from '../../../dashboard.providers';
import { DashboardOverview } from '../../../domain/dashboard-overview';
import { DashboardRepository } from '../../../domain/dashboard.repository';
import { InMemoryDashboardRepository } from '../../../infrastructure/in-memory-dashboard.repository';

async function setup(changes: Partial<DashboardOverview> = {}, periods = new FakePeriodRepository()) {
  const sample = await firstValueFrom(new InMemoryDashboardRepository().overview());

  await TestBed.configureTestingModule({
    imports: [HomePageComponent, translocoTesting()],
    providers: [
      provideRouter([]),
      provideDashboard(),
      provideFakePeriods(periods),
      { provide: DashboardRepository, useValue: { overview: () => of({ ...sample, ...changes }) } },
    ],
  }).compileComponents();
}

function render() {
  const fixture = TestBed.createComponent(HomePageComponent);
  fixture.detectChanges();

  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function text(element: HTMLElement, testId: string): string {
  return element.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('HomePageComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('with the sample month', () => {
    beforeEach(() => setup());

    it('leads with what is available to spend until the end of the month', () => {
      const { element } = render();

      expect(text(element, 'available')).toContain('2,840,000');
      expect(text(element, 'hero')).toContain('Available to spend until October 31');
      expect(text(element, 'per-day')).toContain('next 11 days');
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
      expect(element.textContent).not.toContain('6,200,000');
      expect(element.textContent).not.toContain('3,200,000');
      expect(toggle.textContent).toContain('Show amounts');
    });

    it('translates the view into Spanish', () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toContain('Resumen');
      expect(text(element, 'hero')).toContain('Disponible para gastar hasta el 31 de octubre');
      expect(element.textContent).toContain('Flujo de caja');
      expect(element.textContent).toContain('Vivienda');
    });
  });

  describe('when the month is overspent', () => {
    beforeEach(() => setup({ expenses: 5_800_000 }));

    it('says so calmly and drops the daily amount', () => {
      const { element } = render();

      expect(text(element, 'hero')).toContain("used more than you received");
      expect(text(element, 'hero')).toContain('600,000 more than what came in');
      expect(element.querySelector('[data-testid="per-day"]')).toBeNull();
    });
  });

  describe('without previous months', () => {
    beforeEach(() => setup({ cashFlow: [{ month: '2026-10', income: 6_200_000, expenses: 2_360_000 }] }));

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
      await setup({}, periods);
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
      await setup({}, periods);
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
