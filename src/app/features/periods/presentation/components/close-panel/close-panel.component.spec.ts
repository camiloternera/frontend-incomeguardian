import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { PeriodError } from '../../../domain/period-error';
import { FakePeriodRepository, provideFakePeriods } from '../../period-repository.fake';
import { PeriodWorkspace } from '../../period-workspace';
import { ClosePanelComponent } from './close-panel.component';

describe('ClosePanelComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakePeriodRepository();
    await TestBed.configureTestingModule({
      imports: [ClosePanelComponent, translocoTesting()],
      providers: [provideRouter([]), provideFakePeriods(fake)],
    }).compileComponents();
  });

  function workspace(): PeriodWorkspace {
    return TestBed.inject(PeriodWorkspace);
  }

  /** Monta el panel y lo abre para el período indicado. */
  function open(year: number, month: number | null) {
    const fixture = TestBed.createComponent(ClosePanelComponent);
    fixture.detectChanges();
    workspace().openClose({ year, month });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      element,
      query: (testId: string) => element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`),
      click(testId: string) {
        element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
        fixture.detectChanges();
      },
    };
  }

  function dialog(element: HTMLElement): HTMLDialogElement {
    return element.querySelector<HTMLDialogElement>('[data-testid="close-panel"]')!;
  }

  it('stays closed until a period is chosen', () => {
    const fixture = TestBed.createComponent(ClosePanelComponent);
    fixture.detectChanges();

    expect(dialog(fixture.nativeElement).open).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it('reviews the month before closing it', () => {
    const view = open(2026, 10);

    expect(dialog(view.element).open).toBe(true);
    expect(fake.calls).toEqual(['review 2026-10']);
    expect(view.element.querySelector('h2')?.textContent).toContain('Close October 2026');
    expect(view.query('close-panel-totals')?.textContent).toContain('$4,500,000');
    expect(view.query('close-panel-totals')?.textContent).toContain('53.3%');
    expect(view.query('close-panel-balance')?.textContent).toContain('Bancolombia');
    expect(view.element.textContent).toContain('Balances as of October 31');
    expect(view.element.textContent).toContain("Transactions dated in October can't be created, edited or deleted.");
    expect(view.query('close-panel-uncategorized')).toBeNull();
    expect(view.query('close-panel-confirm')?.textContent).toContain('Close October');
  });

  it('points to the uncategorized transactions without blocking the close', () => {
    fake.reviewData = {
      year: 2026,
      month: 10,
      monthState: null,
      yearState: null,
      totals: [],
      balances: [],
      uncategorizedCount: 3,
    };
    const view = open(2026, 10);

    expect(view.query('close-panel-uncategorized')?.textContent).toContain('3 uncategorized transactions · optional');
    expect(view.query('close-panel-uncategorized')?.querySelector('a')?.getAttribute('href')).toBe('/transactions');
    expect(view.element.textContent).toContain('There was no income or spending in this period.');
    expect(view.element.textContent).toContain('No accounts were open in this period.');
    expect(view.query('close-panel-confirm')?.disabled).toBe(false);
  });

  it('closes the month, confirms it and can undo it on the spot', () => {
    const view = open(2026, 10);

    view.click('close-panel-confirm');

    expect(fake.calls).toContain('close 2026-10');
    expect(view.query('close-panel-done')?.textContent).toContain('October is closed');

    view.click('close-panel-undo');

    // Deshacer reabre sin re-cierre automático ni aviso, y vuelve a la revisión.
    expect(fake.lastReopen).toEqual({ period: { year: 2026, month: 10 }, request: { recloseMode: 'manual', reason: null } });
    expect(workspace().notice()).toBeNull();
    expect(view.query('close-panel-done')).toBeNull();
    expect(fake.count('review 2026-10')).toBe(2);
  });

  it('reviews the whole year and says which months it will close too', () => {
    const view = open(2026, null);

    expect(view.element.querySelector('h2')?.textContent).toContain('Close 2026');
    expect(view.element.textContent).toContain('Months of 2026');
    expect(view.element.textContent).toContain('2 months are still open. Closing the year also closes them.');
    expect(view.element.querySelectorAll('[aria-labelledby="close-panel-months"] li').length).toBe(12);

    view.click('close-panel-confirm');

    expect(fake.calls).toContain('close 2026');
    expect(view.query('close-panel-done')?.textContent).toContain('2026 is closed');
  });

  it('keeps the review and shows the error when closing fails', () => {
    const view = open(2026, 10);
    fake.failWith = new PeriodError('Close the previous months first: they close in order.');

    view.click('close-panel-confirm');

    expect(view.query('close-panel-submit-error')?.textContent).toContain('Close the previous months first');
    expect(view.query('close-panel-done')).toBeNull();
    expect(view.query('close-panel-confirm')?.disabled).toBe(false);
  });

  it('retries a review that could not be loaded', () => {
    fake.failWith = new PeriodError('Server down.');
    const view = open(2026, 10);

    expect(view.query('close-panel-error')?.textContent).toContain('Server down.');
    expect(view.query('close-panel-confirm')?.disabled).toBe(true);

    view.query('close-panel-error')!.parentElement!.querySelector('button')!.click();
    view.fixture.detectChanges();

    expect(view.query('close-panel-error')).toBeNull();
    expect(view.query('close-panel-totals')).not.toBeNull();
  });

  it('closes the panel without closing the period', () => {
    const view = open(2026, 10);

    view.click('close-panel-dismiss');

    expect(workspace().closing()).toBeNull();
    expect(dialog(view.element).open).toBe(false);
    expect(fake.calls).not.toContain('close 2026-10');
  });

  it('translates the review into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const view = open(2026, 10);

    expect(view.element.querySelector('h2')?.textContent).toContain('Cerrar octubre 2026');
    expect(view.element.textContent).toContain('31 de octubre');
  });
});
