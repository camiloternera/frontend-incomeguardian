import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { PeriodError } from '../../../domain/period-error';
import { FakePeriodRepository, provideFakePeriods } from '../../period-repository.fake';
import { PeriodWorkspace, ReopenOrigin } from '../../period-workspace';
import { ReopenDialogComponent } from './reopen-dialog.component';

describe('ReopenDialogComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T15:00:00Z'));
    localStorage.clear();
    fake = new FakePeriodRepository();
    await TestBed.configureTestingModule({
      imports: [ReopenDialogComponent, translocoTesting()],
      providers: [provideFakePeriods(fake)],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function workspace(): PeriodWorkspace {
    return TestBed.inject(PeriodWorkspace);
  }

  /** Monta el modal y lo abre; espera a que `ngModel` enlace el campo del motivo. */
  async function open(year: number, month: number | null, origin: ReopenOrigin = 'selector') {
    const fixture = TestBed.createComponent(ReopenDialogComponent);
    fixture.detectChanges();
    workspace().openReopen({ year, month }, origin);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      element,
      query: <E extends HTMLElement = HTMLElement>(testId: string) => element.querySelector<E>(`[data-testid="${testId}"]`),
      submit() {
        element.querySelector('form')!.dispatchEvent(new Event('submit'));
        fixture.detectChanges();
      },
    };
  }

  it('opens for a month and recommends closing it again tomorrow', async () => {
    const view = await open(2026, 9);

    expect(view.query<HTMLDialogElement>('reopen-dialog')!.open).toBe(true);
    expect(view.element.querySelector('h2')?.textContent).toContain('Reopen September 2026');
    expect(view.query('reopen-mode-auto')?.querySelector('input')?.checked).toBe(true);
    expect(view.query('reopen-mode-auto')?.textContent).toContain('It closes on its own on Nov 9, 2026 at 12:00 a.m.');
    expect(view.query('reopen-confirm')?.textContent).toContain('Reopen September');
    expect(view.query('reopen-closed-year')).toBeNull();
  });

  it('reopens with the chosen mode and reason, and announces it', async () => {
    const view = await open(2026, 9);

    const manual = view.query('reopen-mode-manual')!.querySelector('input')!;
    manual.checked = true;
    manual.dispatchEvent(new Event('change'));
    const reason = view.query<HTMLInputElement>('reopen-reason')!;
    reason.value = 'Faltó un gasto';
    reason.dispatchEvent(new Event('input'));
    view.fixture.detectChanges();

    expect(view.element.textContent).toContain('14/200');

    view.submit();

    expect(fake.lastReopen).toEqual({
      period: { year: 2026, month: 9 },
      request: { recloseMode: 'manual', reason: 'Faltó un gasto' },
    });
    expect(workspace().reopening()).toBeNull();
    expect(workspace().notice()).toEqual({ period: { year: 2026, month: 9 }, mode: 'manual', origin: 'selector' });
    expect(view.query<HTMLDialogElement>('reopen-dialog')!.open).toBe(false);
  });

  it('warns that reopening a month of a closed year reopens the year too', async () => {
    fake.years[2026] = { ...fake.years[2026], yearClosed: true };
    workspace().loadYear(2026);
    const view = await open(2026, 9);

    expect(view.query('reopen-closed-year')?.textContent).toContain(
      '2026 is closed. Reopening September also reopens the year until you close it again.',
    );
  });

  it('reopens a year without asking when to close it again', async () => {
    const view = await open(2025, null);

    expect(view.element.querySelector('h2')?.textContent).toContain('Reopen 2025');
    expect(view.element.textContent).toContain('its months stay closed');
    expect(view.query('reopen-mode-auto')).toBeNull();

    view.submit();

    expect(fake.lastReopen).toEqual({ period: { year: 2025, month: null }, request: { reason: null } });
    expect(workspace().notice()?.mode).toBeNull();
  });

  it('keeps the dialog open with the error when reopening fails', async () => {
    const view = await open(2026, 9);
    fake.failWith = new PeriodError('This period was already open.');

    view.submit();

    expect(view.query('reopen-error')?.textContent).toContain('This period was already open.');
    expect(workspace().reopening()).not.toBeNull();
    expect(workspace().notice()).toBeNull();
  });

  it('starts clean every time it opens', async () => {
    const view = await open(2026, 9);
    const reason = view.query<HTMLInputElement>('reopen-reason')!;
    reason.value = 'Borrador';
    reason.dispatchEvent(new Event('input'));
    view.element.querySelector<HTMLButtonElement>('form button[type="button"]')!.click();
    view.fixture.detectChanges();

    expect(workspace().reopening()).toBeNull();

    workspace().openReopen({ year: 2026, month: 8 });
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    expect(view.element.textContent).toContain('0/200');
    expect(view.element.querySelector('h2')?.textContent).toContain('Reopen August 2026');
  });

  it('translates the dialog into Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const view = await open(2026, 9);

    expect(view.element.querySelector('h2')?.textContent).toContain('Reabrir Septiembre 2026');
    expect(view.query('reopen-mode-auto')?.textContent).toContain('Se cierra solo el 9 nov 2026');
  });
});
