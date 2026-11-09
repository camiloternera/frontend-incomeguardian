import { TestBed } from '@angular/core/testing';
import { FakePeriodRepository } from '../presentation/period-repository.fake';
import { PeriodRepository } from '../domain/period.repository';
import {
  ClosePeriodUseCase,
  GetPeriodHistoryUseCase,
  PERIOD_HISTORY_LIMIT,
  ReopenPeriodUseCase,
  SavePeriodSettingsUseCase,
} from './period-use-cases';

describe('period use cases', () => {
  let fake: FakePeriodRepository;

  beforeEach(() => {
    fake = new FakePeriodRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: PeriodRepository, useValue: fake },
        ClosePeriodUseCase,
        ReopenPeriodUseCase,
        GetPeriodHistoryUseCase,
        SavePeriodSettingsUseCase,
      ],
    });
  });

  it('closes a month, or the whole year when there is no month', () => {
    const close = TestBed.inject(ClosePeriodUseCase);

    close.execute({ year: 2026, month: 10 }).subscribe();
    close.execute({ year: 2026, month: null }).subscribe();

    expect(fake.calls).toEqual(['close 2026-10', 'close 2026']);
    expect(fake.years[2026].yearClosed).toBe(true);
  });

  it('reopens a month with its reclose mode and a trimmed reason', () => {
    TestBed.inject(ReopenPeriodUseCase)
      .execute({ year: 2026, month: 9 }, { recloseMode: 'manual', reason: '  Faltó un gasto ' })
      .subscribe();

    expect(fake.lastReopen).toEqual({
      period: { year: 2026, month: 9 },
      request: { recloseMode: 'manual', reason: 'Faltó un gasto' },
    });
  });

  it('reopens the year without a reclose mode and drops a blank reason', () => {
    TestBed.inject(ReopenPeriodUseCase).execute({ year: 2026, month: null }, { recloseMode: 'auto', reason: '   ' }).subscribe();

    expect(fake.calls).toEqual(['reopen 2026']);
    expect(fake.lastReopen).toEqual({ period: { year: 2026, month: null }, request: { reason: null } });
  });

  it('asks for the latest history events by default', () => {
    TestBed.inject(GetPeriodHistoryUseCase).execute().subscribe();
    TestBed.inject(GetPeriodHistoryUseCase).execute(3).subscribe();

    expect(fake.calls).toEqual([`history ${PERIOD_HISTORY_LIMIT}`, 'history 3']);
  });

  it('saves the closing settings as given', () => {
    const settings = { autoCloseEnabled: false, autoCloseDay: 10, closeYearWithDecember: true, remindOnMonthEnd: false };
    let result: unknown;

    TestBed.inject(SavePeriodSettingsUseCase).execute(settings).subscribe((value) => (result = value));

    expect(fake.saved).toEqual([settings]);
    expect(result).toEqual(settings);
  });
});
