import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  PendingPeriod,
  PeriodClosingSettings,
  PeriodLog,
  PeriodMonth,
  PeriodMonthStatus,
  PeriodRef,
  PeriodReview,
  PeriodYear,
  ReopenRequest,
  lastDayOf,
} from '../domain/period';
import { PeriodRepository } from '../domain/period.repository';
import { providePeriods } from '../periods.providers';

/** Arma un mes de prueba; los cerrados se pueden reabrir y los pendientes cerrar. */
export function periodMonth(month: number, status: PeriodMonthStatus, overrides: Partial<PeriodMonth> = {}): PeriodMonth {
  return {
    month,
    status,
    closedAt: status === 'closed' ? `${lastDayOf(2026, month)}T05:00:00Z` : null,
    closedAutomatically: false,
    reopenedAt: null,
    recloseMode: null,
    recloseAt: null,
    autoCloseOn: null,
    canClose: status === 'pending',
    canReopen: status === 'closed',
    ...overrides,
  };
}

/**
 * Arma un año de prueba con un estado por mes, de enero a diciembre. Los meses que falten en
 * `statuses` quedan como `future`.
 */
export function periodYear(
  year: number,
  statuses: readonly PeriodMonthStatus[],
  overrides: Partial<PeriodYear> = {},
): PeriodYear {
  const months = Array.from({ length: 12 }, (_, index) => periodMonth(index + 1, statuses[index] ?? 'future'));

  return {
    year,
    yearClosed: false,
    yearClosedAt: null,
    yearClosedAutomatically: false,
    canCloseYear: false,
    canReopenYear: false,
    firstActivity: `${year}-01`,
    months,
    ...overrides,
  };
}

/** Noviembre de 2026 en curso, con septiembre cerrado y octubre pendiente. */
export function sampleYear(): PeriodYear {
  return periodYear(2026, [
    'closed',
    'closed',
    'closed',
    'closed',
    'closed',
    'closed',
    'closed',
    'closed',
    'closed',
    'pending',
    'current',
  ]);
}

/**
 * Repositorio de períodos en memoria para los tests. Cerrar y reabrir cambian `years`, como hace el
 * backend; `failWith` fuerza el error de la siguiente llamada y `calls` registra cada una.
 */
export class FakePeriodRepository extends PeriodRepository {
  years: Record<number, PeriodYear> = { 2026: sampleYear() };
  pendingPeriod: PendingPeriod | null = null;
  settingsData: PeriodClosingSettings = {
    autoCloseEnabled: true,
    autoCloseDay: 5,
    closeYearWithDecember: false,
    remindOnMonthEnd: true,
  };
  logs: PeriodLog[] = [];
  /** Revisión fija; si es null se arma con el estado actual del período. */
  reviewData: PeriodReview | null = null;
  failWith: unknown = null;
  readonly calls: string[] = [];
  lastReopen: { period: PeriodRef; request: ReopenRequest } | null = null;
  saved: PeriodClosingSettings[] = [];

  year(year: number): Observable<PeriodYear> {
    return this.respond(`year ${year}`, () => structuredClone(this.yearOf(year)));
  }

  pending(): Observable<PendingPeriod | null> {
    return this.respond('pending', () => (this.pendingPeriod ? { ...this.pendingPeriod } : null));
  }

  review(period: PeriodRef): Observable<PeriodReview> {
    return this.respond(`review ${label(period)}`, () => {
      if (this.reviewData) {
        return structuredClone(this.reviewData);
      }

      const year = structuredClone(this.yearOf(period.year));

      return {
        year: period.year,
        month: period.month,
        monthState: period.month === null ? null : year.months[period.month - 1],
        yearState: period.month === null ? year : null,
        totals: [{ currency: 'COP', income: 4_500_000, expense: 2_100_000, savings: 2_400_000, savingsRate: 53.3 }],
        balances: [{ accountId: 2, name: 'Bancolombia', currency: 'COP', balance: 1_250_000, isActive: true }],
        uncategorizedCount: 0,
      };
    });
  }

  closeMonth(year: number, month: number): Observable<PeriodMonth> {
    return this.respond(`close ${label({ year, month })}`, () => {
      const updated = periodMonth(month, 'closed');
      this.setMonth(year, updated);
      this.pendingPeriod = this.pendingPeriod?.year === year && this.pendingPeriod.month === month ? null : this.pendingPeriod;

      return updated;
    });
  }

  reopenMonth(year: number, month: number, request: ReopenRequest): Observable<PeriodMonth> {
    this.lastReopen = { period: { year, month }, request };

    return this.respond(`reopen ${label({ year, month })}`, () => {
      const updated = periodMonth(month, 'pending', {
        reopenedAt: '2026-11-08T15:00:00Z',
        recloseMode: request.recloseMode ?? 'auto',
      });
      this.setMonth(year, updated);
      this.years[year] = { ...this.yearOf(year), yearClosed: false };

      return updated;
    });
  }

  closeYear(year: number): Observable<PeriodYear> {
    return this.respond(`close ${year}`, () => {
      const current = this.yearOf(year);
      this.years[year] = {
        ...current,
        yearClosed: true,
        yearClosedAt: '2027-01-01T05:00:00Z',
        canCloseYear: false,
        canReopenYear: true,
        months: current.months.map((month) =>
          month.status === 'noActivity' ? month : periodMonth(month.month, 'closed'),
        ),
      };

      return structuredClone(this.years[year]);
    });
  }

  reopenYear(year: number, reason: string | null): Observable<PeriodYear> {
    this.lastReopen = { period: { year, month: null }, request: { reason } };

    return this.respond(`reopen ${year}`, () => {
      this.years[year] = { ...this.yearOf(year), yearClosed: false, yearClosedAt: null, canReopenYear: false, canCloseYear: true };

      return structuredClone(this.years[year]);
    });
  }

  history(limit: number): Observable<PeriodLog[]> {
    return this.respond(`history ${limit}`, () => this.logs.slice(0, limit));
  }

  settings(): Observable<PeriodClosingSettings> {
    return this.respond('settings', () => ({ ...this.settingsData }));
  }

  saveSettings(settings: PeriodClosingSettings): Observable<PeriodClosingSettings> {
    return this.respond('saveSettings', () => {
      this.saved.push(settings);
      this.settingsData = { ...settings };

      return { ...settings };
    });
  }

  /** Cuántas veces se pidió una operación, por ejemplo `year 2026`. */
  count(call: string): number {
    return this.calls.filter((item) => item === call).length;
  }

  private yearOf(year: number): PeriodYear {
    return this.years[year] ?? periodYear(year, Array(12).fill('noActivity'), { firstActivity: null });
  }

  private setMonth(year: number, month: PeriodMonth): void {
    const current = this.yearOf(year);
    this.years[year] = {
      ...current,
      months: current.months.map((item) => (item.month === month.month ? month : item)),
    };
  }

  private respond<T>(call: string, value: () => T): Observable<T> {
    this.calls.push(call);
    const error = this.failWith;
    this.failWith = null;

    return error ? throwError(() => error) : of(value());
  }
}

function label(period: PeriodRef): string {
  return period.month === null ? `${period.year}` : `${period.year}-${String(period.month).padStart(2, '0')}`;
}

/** Los proveedores reales del cierre, con el repositorio HTTP sustituido por el falso. */
export function provideFakePeriods(fake: FakePeriodRepository = new FakePeriodRepository()): Provider[] {
  return [...providePeriods(), { provide: PeriodRepository, useValue: fake }];
}
