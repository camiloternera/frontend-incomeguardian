import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { PeriodRef } from '../domain/period';
import { PeriodError } from '../domain/period-error';
import { FakePeriodRepository, provideFakePeriods } from './period-repository.fake';
import { PeriodWorkspace } from './period-workspace';

describe('PeriodWorkspace', () => {
  let fake: FakePeriodRepository;
  let workspace: PeriodWorkspace;

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideFakePeriods(fake)],
    });
    workspace = TestBed.inject(PeriodWorkspace);
  }

  beforeEach(() => {
    localStorage.clear();
    fake = new FakePeriodRepository();
  });

  it('asks for a year once and keeps it, unless forced', () => {
    setup();

    workspace.loadYear(2026);
    workspace.loadYear(2026);

    expect(fake.count('year 2026')).toBe(1);
    expect(workspace.years()[2026]).toEqual({ status: 'ready', data: expect.objectContaining({ year: 2026 }) });

    workspace.loadYear(2026, true);

    expect(fake.count('year 2026')).toBe(2);
  });

  it('keeps the error of a year and retries it on the next request', () => {
    setup();
    fake.failWith = new PeriodError('Server down.');

    workspace.loadYear(2026);

    expect(workspace.years()[2026]).toEqual({ status: 'error', message: 'Server down.' });

    workspace.loadYear(2026);

    expect(workspace.years()[2026].status).toBe('ready');
  });

  it('shows the generic copy for errors that are not from this domain', () => {
    setup();
    fake.failWith = new Error('boom');

    workspace.loadYear(2026);

    expect(workspace.years()[2026]).toEqual({ status: 'error', message: 'Something went wrong. Please try again.' });
  });

  it('asks for the pending month once and hides it when the request fails', () => {
    fake.pendingPeriod = { year: 2026, month: 10, endedOn: '2026-10-31', autoCloseOn: null, canClose: true };
    setup();

    workspace.loadPending();
    workspace.loadPending();

    expect(fake.count('pending')).toBe(1);
    expect(workspace.pending()).toEqual(expect.objectContaining({ year: 2026, month: 10 }));

    fake.failWith = new PeriodError('Server down.');
    workspace.loadPending(true);

    expect(workspace.pending()).toBeNull();
  });

  it('remembers the snoozed month across sessions', () => {
    const pending = { year: 2026, month: 10, endedOn: '2026-10-31', autoCloseOn: null, canClose: true };
    setup();

    expect(workspace.isSnoozed(pending)).toBe(false);
    workspace.snooze(pending);

    expect(workspace.isSnoozed(pending)).toBe(true);
    expect(workspace.isSnoozed({ ...pending, month: 11 })).toBe(false);
    expect(localStorage.getItem('ig.periods.snoozed')).toBe('2026-10');

    TestBed.resetTestingModule();
    setup();

    expect(workspace.isSnoozed(pending)).toBe(true);
  });

  it('refreshes the year and the pending month after closing, and announces it', () => {
    setup();
    const changes: PeriodRef[] = [];
    workspace.changed$.subscribe((period) => changes.push(period));
    workspace.loadYear(2026);
    workspace.loadPending();

    workspace.close({ year: 2026, month: 10 }).subscribe();

    expect(fake.calls).toEqual(['year 2026', 'pending', 'close 2026-10', 'year 2026', 'pending']);
    expect(changes).toEqual([{ year: 2026, month: 10 }]);
    const entry = workspace.years()[2026];
    expect(entry.status === 'ready' && entry.data.months[9].status).toBe('closed');
  });

  it('keeps the year on screen while it reloads', () => {
    setup();
    workspace.loadYear(2026);
    const before = workspace.years()[2026];
    // La respuesta no llega: el año sigue con los datos anteriores en vez de volver a cargar.
    vi.spyOn(fake, 'year').mockReturnValue(NEVER);

    workspace.loadYear(2026, true);

    expect(workspace.years()[2026]).toBe(before);
    expect(before.status).toBe('ready');
  });

  it('shows a year as loading the first time it is asked for', () => {
    setup();
    vi.spyOn(fake, 'year').mockReturnValue(NEVER);

    workspace.loadYear(2025);

    expect(workspace.years()[2025]).toEqual({ status: 'loading' });
  });

  it('announces a month reopening with its reclose mode and origin', () => {
    setup();

    workspace.reopen({ year: 2026, month: 9 }, { recloseMode: 'manual', reason: null }, 'form').subscribe();

    expect(workspace.notice()).toEqual({ period: { year: 2026, month: 9 }, mode: 'manual', origin: 'form' });
    expect(fake.calls).toContain('year 2026');
  });

  it('announces a year reopening without a reclose mode', () => {
    setup();

    workspace.reopen({ year: 2025, month: null }, { reason: null }, 'selector').subscribe();

    expect(workspace.notice()).toEqual({ period: { year: 2025, month: null }, mode: null, origin: 'selector' });
  });

  it('reopens silently when there is no origin, as the undo of a close does', () => {
    setup();

    workspace.reopen({ year: 2026, month: 9 }, { recloseMode: 'manual', reason: null }, null).subscribe();

    expect(workspace.notice()).toBeNull();
    expect(fake.lastReopen?.period).toEqual({ year: 2026, month: 9 });
  });

  it('drops the reopen notice once that period closes again', () => {
    setup();
    workspace.reopen({ year: 2026, month: 9 }, { reason: null }, 'selector').subscribe();

    workspace.close({ year: 2026, month: 8 }).subscribe();
    expect(workspace.notice()).not.toBeNull();

    workspace.close({ year: 2026, month: 9 }).subscribe();
    expect(workspace.notice()).toBeNull();
  });

  it('leaves everything as it was when closing fails', () => {
    setup();
    const changes: PeriodRef[] = [];
    workspace.changed$.subscribe((period) => changes.push(period));
    fake.failWith = new PeriodError('Already closed.');
    let error: unknown;

    workspace.close({ year: 2026, month: 10 }).subscribe({ error: (value) => (error = value) });

    expect((error as PeriodError).message).toBe('Already closed.');
    expect(changes).toEqual([]);
    expect(fake.calls).toEqual(['close 2026-10']);
  });

  it('opens the close panel and the reopen dialog on demand', () => {
    setup();

    workspace.openClose({ year: 2026, month: 10 });
    workspace.openReopen({ year: 2026, month: 9 });

    expect(workspace.closing()).toEqual({ year: 2026, month: 10 });
    expect(workspace.reopening()).toEqual({ period: { year: 2026, month: 9 }, origin: 'selector' });

    workspace.openReopen({ year: 2026, month: 9 }, 'form');

    expect(workspace.reopening()?.origin).toBe('form');
  });
});
