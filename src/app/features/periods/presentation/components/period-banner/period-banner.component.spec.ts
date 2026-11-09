import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { PendingPeriod } from '../../../domain/period';
import { FakePeriodRepository, provideFakePeriods } from '../../period-repository.fake';
import { PeriodWorkspace } from '../../period-workspace';
import { PeriodBannerComponent } from './period-banner.component';

const OCTOBER: PendingPeriod = { year: 2026, month: 10, endedOn: '2026-10-31', autoCloseOn: '2026-11-05', canClose: true };

describe('PeriodBannerComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakePeriodRepository();
    await TestBed.configureTestingModule({
      imports: [PeriodBannerComponent, translocoTesting()],
      providers: [provideFakePeriods(fake)],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(PeriodBannerComponent);
    fixture.detectChanges();

    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function banner(element: HTMLElement): HTMLElement | null {
    return element.querySelector('[data-testid="period-banner"]');
  }

  it('proposes closing the month that ended and is still open', () => {
    fake.pendingPeriod = OCTOBER;
    const { element } = render();

    expect(banner(element)?.textContent).toContain('October is over. Close it?');
    expect(banner(element)?.textContent).toContain('blocks new transactions dated in October');
    expect(fake.calls).toEqual(['pending']);
  });

  it('stays hidden when there is no pending month', () => {
    expect(banner(render().element)).toBeNull();
  });

  it('stays hidden when the pending month cannot be read', () => {
    fake.pendingPeriod = OCTOBER;
    fake.failWith = new Error('Server down.');

    expect(banner(render().element)).toBeNull();
    expect(TestBed.inject(PeriodWorkspace).pending()).toBeNull();
  });

  it('opens the close panel for that month', () => {
    fake.pendingPeriod = OCTOBER;
    const { element } = render();

    element.querySelector<HTMLButtonElement>('[data-testid="period-banner-review"]')!.click();

    expect(TestBed.inject(PeriodWorkspace).closing()).toEqual({ year: 2026, month: 10 });
  });

  it('hides itself with «Later» and stays hidden for that month', () => {
    fake.pendingPeriod = OCTOBER;
    const { fixture, element } = render();

    element.querySelector<HTMLButtonElement>('[data-testid="period-banner-later"]')!.click();
    fixture.detectChanges();

    expect(banner(element)).toBeNull();
    expect(TestBed.inject(PeriodWorkspace).isSnoozed(OCTOBER)).toBe(true);
  });

  it('comes back for the next pending month', () => {
    localStorage.setItem('ig.periods.snoozed', '2026-09');
    fake.pendingPeriod = OCTOBER;

    expect(banner(render().element)).not.toBeNull();
  });

  it('translates the month into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    fake.pendingPeriod = OCTOBER;
    const { element } = render();

    expect(banner(element)?.textContent).toContain('Octubre terminó. ¿Lo cerramos?');
    expect(banner(element)?.textContent).toContain('Más tarde');
  });
});
