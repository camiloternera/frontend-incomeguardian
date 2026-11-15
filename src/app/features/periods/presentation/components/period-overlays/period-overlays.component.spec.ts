import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { MonthRange, PeriodMonthStatus } from '../../../domain/period';
import { PeriodError } from '../../../domain/period-error';
import { FakePeriodRepository, periodYear, provideFakePeriods } from '../../period-repository.fake';
import { PeriodWorkspace } from '../../period-workspace';
import { PeriodOverlaysComponent } from './period-overlays.component';

describe('PeriodOverlaysComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakePeriodRepository();
    await TestBed.configureTestingModule({
      imports: [PeriodOverlaysComponent, translocoTesting()],
      providers: [provideRouter([]), provideFakePeriods(fake)],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function workspace(): PeriodWorkspace {
    return TestBed.inject(PeriodWorkspace);
  }

  function render() {
    const fixture = TestBed.createComponent(PeriodOverlaysComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      element,
      query: (testId: string) => element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`),
    };
  }

  /** Reabre septiembre como lo haría el modal y deja el aviso en pantalla. */
  function reopenSeptember(view: ReturnType<typeof render>, origin: 'form' | 'selector', mode: 'auto' | 'manual' = 'auto') {
    workspace().reopen({ year: 2026, month: 9 }, { recloseMode: mode, reason: null }, origin).subscribe();
    view.fixture.detectChanges();
  }

  it('holds the close panel and the reopen dialog, with no notice by default', () => {
    const view = render();

    expect(view.query('close-panel')).not.toBeNull();
    expect(view.query('reopen-dialog')).not.toBeNull();
    expect(view.query('period-notice')).toBeNull();
  });

  it('confirms a reopening from the selector and lets it be dismissed', () => {
    const view = render();
    reopenSeptember(view, 'selector');

    expect(view.query('period-notice')?.textContent).toContain('September 2026 is open.');
    expect(view.query('period-notice')?.textContent).toContain('It closes on its own tomorrow.');
    expect(view.query('period-notice-keep-going')).toBeNull();

    view.query('period-notice')!.querySelector<HTMLButtonElement>('[aria-label="Dismiss"]')!.click();
    view.fixture.detectChanges();

    expect(view.query('period-notice')).toBeNull();
  });

  it('invites to keep recording when the reopening came from a form', () => {
    const view = render();
    reopenSeptember(view, 'form', 'manual');

    expect(view.query('period-notice')?.textContent).toContain("Close it from the month selector when you're done.");

    view.query('period-notice-keep-going')!.click();
    view.fixture.detectChanges();

    expect(workspace().notice()).toBeNull();
  });

  it('confirms a year reopening and its months staying closed', () => {
    const view = render();
    workspace().reopen({ year: 2025, month: null }, { reason: null }, 'selector').subscribe();
    view.fixture.detectChanges();

    expect(view.query('period-notice')?.textContent).toContain('2025 is open.');
    expect(view.query('period-notice')?.textContent).toContain('Its months stay closed.');
  });

  it('closes the period again straight from the notice', () => {
    const view = render();
    reopenSeptember(view, 'selector');

    view.query('period-notice-close-again')!.click();
    view.fixture.detectChanges();

    expect(fake.calls).toContain('close 2026-09');
    expect(view.query('period-notice')).toBeNull();
  });

  it('keeps the notice with the error when closing again fails', () => {
    const view = render();
    reopenSeptember(view, 'selector');
    fake.failWith = new PeriodError('This period was already closed.');

    view.query('period-notice-close-again')!.click();
    view.fixture.detectChanges();

    expect(view.query('period-notice')?.querySelector('[role="alert"]')?.textContent).toContain('This period was already closed.');
    expect(view.query('period-notice-close-again')?.disabled).toBe(false);
  });

  describe('months opened by a transaction before the first account', () => {
    /** 2026 con febrero a abril en `status` y la primera cuenta en mayo. */
    function openedYear(status: PeriodMonthStatus) {
      const statuses = Array(12).fill('pending') as PeriodMonthStatus[];
      statuses[0] = 'noActivity';
      [1, 2, 3].forEach((index) => (statuses[index] = status));
      statuses[10] = 'current';
      statuses[11] = 'future';
      fake.years[2026] = periodYear(2026, statuses, { firstActivity: '2026-05' });
    }

    const ONE: MonthRange = { from: { year: 2026, month: 4 }, to: { year: 2026, month: 4 } };
    const MANY: MonthRange = { from: { year: 2026, month: 2 }, to: { year: 2026, month: 4 } };

    function announce(view: ReturnType<typeof render>, range: MonthRange) {
      workspace().announceOpened(range);
      view.fixture.detectChanges();
    }

    it('shows nothing while no months were opened', () => {
      const view = render();

      expect(view.query('period-opened')).toBeNull();
    });

    it('offers to close the one month that opened', () => {
      openedYear('pending');
      const view = render();
      announce(view, ONE);

      const notice = view.query('period-opened');
      expect(notice?.textContent).toContain('April 2026 is now open');
      expect(notice?.textContent).toContain('The transaction you added left it open. Do you want to close it now?');
      expect(view.query('period-opened-close')?.textContent).toContain('Close the month');
      expect(view.query('period-opened-ok')).toBeNull();
    });

    it('offers to close all the months that opened', () => {
      openedYear('pending');
      const view = render();
      announce(view, MANY);

      const notice = view.query('period-opened');
      expect(notice?.textContent).toContain('3 months are now open, from February 2026 to April 2026');
      expect(notice?.textContent).toContain('The transaction you added left them open.');
      expect(view.query('period-opened-close')?.textContent).toContain('Close the months');
    });

    it('opens the close panel on the last opened month, which closes the earlier ones too', () => {
      openedYear('pending');
      const view = render();
      announce(view, MANY);

      view.query('period-opened-close')!.click();
      view.fixture.detectChanges();

      expect(workspace().opened()).toBeNull();
      expect(workspace().closing()).toEqual({ year: 2026, month: 4 });
      expect(view.query('period-opened')).toBeNull();
    });

    it('lets the offer wait for later', () => {
      openedYear('pending');
      const view = render();
      announce(view, MANY);

      view.query('period-opened-later')!.click();
      view.fixture.detectChanges();

      expect(workspace().opened()).toBeNull();
      expect(workspace().closing()).toBeNull();
      expect(view.query('period-opened')).toBeNull();
    });

    it('says the month opened and closed on its own when automatic closing already closed it', () => {
      openedYear('closed');
      const view = render();
      announce(view, ONE);

      const notice = view.query('period-opened');
      expect(notice?.textContent).toContain('April 2026 opened and closed on its own');
      expect(notice?.textContent).toContain('Automatic closing is on.');
      expect(view.query('period-opened-close')).toBeNull();
      expect(view.query('period-opened-later')).toBeNull();

      view.query('period-opened-ok')!.click();
      view.fixture.detectChanges();

      expect(workspace().opened()).toBeNull();
      expect(view.query('period-opened')).toBeNull();
    });

    it('says the months opened and closed on their own', () => {
      openedYear('closed');
      const view = render();
      announce(view, MANY);

      expect(view.query('period-opened')?.textContent).toContain(
        'The months from February 2026 to April 2026 opened and closed on their own',
      );
    });

    it('waits while the last opened month still has no activity', () => {
      openedYear('noActivity');
      const view = render();
      announce(view, ONE);

      expect(workspace().opened()).toEqual(ONE);
      expect(view.query('period-opened')).toBeNull();
    });

    it('waits while the year of the last opened month has not arrived', () => {
      vi.spyOn(fake, 'year').mockReturnValue(NEVER);
      const view = render();
      announce(view, { from: { year: 2024, month: 2 }, to: { year: 2024, month: 3 } });

      expect(view.query('period-opened')).toBeNull();
    });

    it('shows up once the fresh year arrives with the month pending', () => {
      openedYear('noActivity');
      const view = render();
      announce(view, ONE);
      expect(view.query('period-opened')).toBeNull();

      openedYear('pending');
      workspace().loadYear(2026, true);
      view.fixture.detectChanges();

      expect(view.query('period-opened')).not.toBeNull();
    });

    it('writes the offer in Spanish', () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      openedYear('pending');
      const view = render();
      announce(view, MANY);

      expect(view.query('period-opened')?.textContent).toContain('Se abrieron 3 meses, de febrero de 2026 a abril de 2026');
      expect(view.query('period-opened-later')?.textContent).toContain('Ahora no');
    });

    it('starts the auto-closed sentence of one month with a capital letter in Spanish', () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      openedYear('closed');
      const view = render();
      announce(view, ONE);

      expect(view.query('period-opened')?.textContent).toContain('Abril de 2026 se abrió y se cerró solo');
    });
  });

  it('goes away on its own after ten seconds', () => {
    vi.useFakeTimers();
    const view = render();
    reopenSeptember(view, 'selector');

    vi.advanceTimersByTime(9_000);
    expect(workspace().notice()).not.toBeNull();

    vi.advanceTimersByTime(1_000);
    view.fixture.detectChanges();

    expect(workspace().notice()).toBeNull();
    expect(view.query('period-notice')).toBeNull();
  });
});
