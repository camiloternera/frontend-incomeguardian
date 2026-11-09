import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { PeriodError } from '../../../domain/period-error';
import { FakePeriodRepository, periodMonth, periodYear, provideFakePeriods } from '../../period-repository.fake';
import { PeriodWorkspace } from '../../period-workspace';
import { PeriodSelectorComponent } from './period-selector.component';

describe('PeriodSelectorComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    // Hoy es 8 de noviembre de 2026 en Bogotá: octubre terminó sin cerrarse.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T15:00:00Z'));
    localStorage.clear();
    fake = new FakePeriodRepository();
    await TestBed.configureTestingModule({
      imports: [PeriodSelectorComponent, translocoTesting()],
      providers: [provideFakePeriods(fake)],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function render() {
    const fixture = TestBed.createComponent(PeriodSelectorComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      element,
      click(testId: string) {
        query(testId)!.click();
        fixture.detectChanges();
      },
      query,
    };

    function query<E extends HTMLElement = HTMLButtonElement>(testId: string): E | null {
      return element.querySelector<E>(`[data-testid="${testId}"]`);
    }
  }

  function workspace(): PeriodWorkspace {
    return TestBed.inject(PeriodWorkspace);
  }

  it('names the current month and opens the periods of the year', () => {
    const view = render();
    const trigger = view.query('period-selector')!;

    expect(trigger.textContent).toContain('November 2026');
    expect(trigger.getAttribute('aria-label')).toBe('November 2026, in progress. View periods');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    view.click('period-selector');

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(view.query('period-popover')?.getAttribute('role')).toBe('dialog');
    // Al abrir siempre se vuelve a consultar el año.
    expect(fake.count('year 2026')).toBe(2);
  });

  it('starts on the oldest pending month and offers to close it', () => {
    const view = render();
    view.click('period-selector');

    expect(view.query('period-month-10')?.getAttribute('aria-pressed')).toBe('true');
    expect(view.query('period-month-10')?.getAttribute('aria-label')).toBe('October 2026, ended, not closed');
    expect(view.query('period-detail')?.textContent).toContain('Ended 8 days ago · still editable');

    view.click('period-close-month');

    expect(workspace().closing()).toEqual({ year: 2026, month: 10 });
    expect(view.query('period-popover')).toBeNull();
  });

  it('says when a pending month closes on its own, or why it cannot be closed yet', () => {
    const year = periodYear(2026, Array(9).fill('closed').concat(['pending', 'current']));
    year.months[9] = periodMonth(10, 'pending', { autoCloseOn: '2026-11-10' });
    fake.years[2026] = year;
    const view = render();
    view.click('period-selector');

    expect(view.query('period-detail')?.textContent).toContain('Closes on its own on Nov 10, 2026.');

    year.months[9] = periodMonth(10, 'pending', { canClose: false });
    workspace().loadYear(2026, true);
    view.fixture.detectChanges();

    expect(view.query('period-detail')?.textContent).toContain('Close the previous months first.');
    expect(view.query('period-close-month')).toBeNull();
  });

  it('shows a closed month and offers to reopen it', () => {
    const view = render();
    view.click('period-selector');

    view.click('period-month-9');

    expect(view.query('period-month-9')?.getAttribute('aria-pressed')).toBe('true');
    expect(view.query('period-detail')?.textContent).toContain('Closed on Sep 30, 2026');

    view.click('period-reopen-month');

    expect(workspace().reopening()).toEqual({ period: { year: 2026, month: 9 }, origin: 'selector' });
    expect(view.query('period-popover')).toBeNull();
  });

  it('does not let a future month be chosen', () => {
    const view = render();
    view.click('period-selector');

    expect(view.query('period-month-12')?.disabled).toBe(true);
    expect(view.query('period-month-11')?.textContent).toContain('Nov');
  });

  it('explains that the year closes once December ends', () => {
    const view = render();
    view.click('period-selector');

    expect(view.query('period-year-row')?.textContent).toContain('You can close the year once December ends.');
    expect(view.query('period-close-year')?.disabled).toBe(true);
    expect(view.query('period-previous-year')?.disabled).toBe(true);
    expect(view.query('period-next-year')?.disabled).toBe(true);
  });

  it('goes back to a previous year and closes it when it is ready', () => {
    fake.years[2026] = { ...fake.years[2026], firstActivity: '2025-03' };
    fake.years[2025] = periodYear(2025, Array(12).fill('closed'), { canCloseYear: true, firstActivity: '2025-03' });
    const view = render();
    view.click('period-selector');

    view.click('period-previous-year');

    expect(view.element.textContent).toContain('2025');
    // Sin pendientes ni mes en curso, el año pasado abre en diciembre.
    expect(view.query('period-month-12')?.getAttribute('aria-pressed')).toBe('true');
    expect(view.query('period-year-row')?.textContent).toContain('The year is over and can be closed.');
    expect(view.query('period-next-year')?.disabled).toBe(false);

    view.click('period-close-year');

    expect(workspace().closing()).toEqual({ year: 2025, month: null });
  });

  it('offers to reopen a closed year', () => {
    fake.years[2026] = { ...fake.years[2026], firstActivity: '2025-03' };
    fake.years[2025] = periodYear(2025, Array(12).fill('closed'), {
      yearClosed: true,
      yearClosedAt: '2026-01-01T05:00:00Z',
      canReopenYear: true,
    });
    const view = render();
    view.click('period-selector');
    view.click('period-previous-year');

    expect(view.query('period-year-row')?.textContent).toContain('Closed on Jan 1, 2026.');

    view.click('period-reopen-year');

    expect(workspace().reopening()).toEqual({ period: { year: 2025, month: null }, origin: 'selector' });
  });

  it('reminds a snoozed pending month next to the button', () => {
    localStorage.setItem('ig.periods.snoozed', '2026-10');
    fake.pendingPeriod = { year: 2026, month: 10, endedOn: '2026-10-31', autoCloseOn: null, canClose: true };
    const view = render();

    expect(view.query('period-pending-chip')?.textContent).toContain('October not closed');

    view.click('period-pending-chip');

    expect(workspace().closing()).toEqual({ year: 2026, month: 10 });
  });

  it('shows the error of the year and retries it', () => {
    const view = render();
    fake.failWith = new PeriodError('Server down.');
    view.click('period-selector');

    expect(view.query('period-popover')?.querySelector('[role="alert"]')?.textContent).toContain('Server down.');

    view.query('period-popover')!.querySelector<HTMLButtonElement>('[role="alert"] + button')!.click();
    view.fixture.detectChanges();

    expect(view.query('period-month-10')).not.toBeNull();
  });

  it('closes with Escape and gives the focus back to the button', async () => {
    const view = render();
    view.click('period-selector');

    view.query<HTMLElement>('period-popover')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    view.fixture.detectChanges();

    expect(view.query('period-popover')).toBeNull();
    expect(document.activeElement).toBe(view.query('period-selector'));
  });

  it('closes when clicking outside', () => {
    const view = render();
    view.click('period-selector');

    document.body.click();
    view.fixture.detectChanges();

    expect(view.query('period-popover')).toBeNull();
  });

  it('translates the months into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const view = render();
    view.click('period-selector');

    expect(view.query('period-selector')?.textContent).toContain('Noviembre 2026');
    expect(view.query('period-month-1')?.textContent).toContain('Ene');
    expect(view.query('period-detail')?.textContent).toContain('Terminó hace 8 días');
  });
});
