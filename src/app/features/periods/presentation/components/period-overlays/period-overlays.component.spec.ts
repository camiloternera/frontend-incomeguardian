import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { PeriodError } from '../../../domain/period-error';
import { FakePeriodRepository, provideFakePeriods } from '../../period-repository.fake';
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
