import { EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable } from 'rxjs';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { PeriodRef, PeriodYear } from '../domain/period';
import { FakePeriodRepository, periodYear, provideFakePeriods } from './period-repository.fake';
import { PeriodSync, PeriodSyncEvent } from './period-sync';
import { PeriodWorkspace } from './period-workspace';

/**
 * Cada vista provee su propio `PeriodWorkspace` en su ruta. Aquí se arman dos, como dos rutas, sobre
 * el mismo repositorio falso y el mismo `PeriodSync` de la raíz.
 */
describe('PeriodSync between workspaces', () => {
  let fake: FakePeriodRepository;
  let summaryInjector: EnvironmentInjector;
  let transactionsInjector: EnvironmentInjector;
  let summary: PeriodWorkspace;
  let transactions: PeriodWorkspace;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakePeriodRepository();
    fake.years[2025] = periodYear(2025, Array(12).fill('closed'));
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideFakePeriods(fake)],
    });
    const root = TestBed.inject(EnvironmentInjector);
    summaryInjector = createEnvironmentInjector([PeriodWorkspace], root);
    transactionsInjector = createEnvironmentInjector([PeriodWorkspace], root);
    summary = summaryInjector.get(PeriodWorkspace);
    transactions = transactionsInjector.get(PeriodWorkspace);
  });

  afterEach(() => {
    [summaryInjector, transactionsInjector].filter((injector) => !injector.destroyed).forEach((injector) => injector.destroy());
  });

  function changesOf(workspace: PeriodWorkspace): PeriodRef[] {
    const changes: PeriodRef[] = [];
    workspace.changed$.subscribe((period) => changes.push(period));

    return changes;
  }

  function monthStatus(workspace: PeriodWorkspace, year: number, month: number): string | undefined {
    const entry = workspace.years()[year];

    return entry?.status === 'ready' ? entry.data.months[month - 1].status : undefined;
  }

  it('gives each view its own workspace but a single sync', () => {
    expect(summary).not.toBe(transactions);
    expect(summaryInjector.get(PeriodSync)).toBe(transactionsInjector.get(PeriodSync));
  });

  it('publishes who changed which period after closing', () => {
    const events: PeriodSyncEvent[] = [];
    TestBed.inject(PeriodSync).changed$.subscribe((event) => events.push(event));

    summary.close({ year: 2026, month: 10 }).subscribe();

    expect(events).toEqual([{ source: summary, period: { year: 2026, month: 10 } }]);
  });

  it('reloads the years the other view already asked for when one view closes a month', () => {
    transactions.loadYear(2025);
    transactions.loadYear(2026);
    transactions.loadPending();
    summary.loadYear(2026);
    const otherChanges = changesOf(transactions);
    fake.calls.length = 0;

    summary.close({ year: 2026, month: 10 }).subscribe();

    // El que cierra recarga su año y el pendiente; el otro, sus dos años y el pendiente que ya pidió.
    expect(fake.count('close 2026-10')).toBe(1);
    expect(fake.count('year 2026')).toBe(2);
    expect(fake.count('year 2025')).toBe(1);
    expect(fake.count('pending')).toBe(2);
    expect(otherChanges).toEqual([{ year: 2026, month: 10 }]);
    expect(monthStatus(transactions, 2026, 10)).toBe('closed');
  });

  it('reloads the other view when one view reopens a month', () => {
    summary.loadYear(2026);
    const otherChanges = changesOf(summary);
    fake.calls.length = 0;

    transactions.reopen({ year: 2026, month: 9 }, { recloseMode: 'manual', reason: null }, 'form').subscribe();

    expect(otherChanges).toEqual([{ year: 2026, month: 9 }]);
    expect(monthStatus(summary, 2026, 9)).toBe('pending');
    // El aviso de la reapertura es solo de la vista que reabrió.
    expect(transactions.notice()).not.toBeNull();
    expect(summary.notice()).toBeNull();
  });

  it('does not bounce the change back: the other view reloads without publishing', () => {
    summary.loadYear(2026);
    transactions.loadYear(2026);
    const events: PeriodSyncEvent[] = [];
    TestBed.inject(PeriodSync).changed$.subscribe((event) => events.push(event));
    const ownChanges = changesOf(summary);
    fake.calls.length = 0;

    summary.close({ year: 2026, month: 10 }).subscribe();

    expect(events).toHaveLength(1);
    expect(ownChanges).toEqual([{ year: 2026, month: 10 }]);
    // Una recarga por vista: la que cerró no vuelve a recargar por el aviso de la otra.
    expect(fake.calls).toEqual(['close 2026-10', 'year 2026', 'pending', 'year 2026']);
  });

  it('does not ask for the pending month in a view that never asked for it', () => {
    summary.loadPending();
    fake.calls.length = 0;

    summary.close({ year: 2026, month: 10 }).subscribe();

    expect(fake.count('pending')).toBe(1);
  });

  it('reloads nothing in a view that has not asked for any year, but still announces the change', () => {
    const otherChanges = changesOf(transactions);
    fake.calls.length = 0;

    summary.close({ year: 2026, month: 10 }).subscribe();

    expect(fake.calls).toEqual(['close 2026-10', 'year 2026', 'pending']);
    expect(transactions.years()).toEqual({});
    expect(otherChanges).toEqual([{ year: 2026, month: 10 }]);
  });

  it('skips a year the other view is still loading for the first time', () => {
    const year = fake.year.bind(fake);
    vi.spyOn(fake, 'year').mockImplementation((value: number): Observable<PeriodYear> => (value === 2024 ? NEVER : year(value)));
    transactions.loadYear(2024);
    transactions.loadYear(2026);
    fake.calls.length = 0;

    summary.close({ year: 2026, month: 10 }).subscribe();

    expect(transactions.years()[2024]).toEqual({ status: 'loading' });
    // 2024 no se vuelve a pedir: su primera respuesta aún no llega.
    expect(vi.mocked(fake.year).mock.calls.filter(([value]) => value === 2024)).toHaveLength(1);
  });

  it('stops listening once the view is destroyed', () => {
    transactions.loadYear(2025);
    transactionsInjector.destroy();
    fake.calls.length = 0;

    summary.close({ year: 2026, month: 10 }).subscribe();

    expect(fake.count('year 2025')).toBe(0);
  });
});
