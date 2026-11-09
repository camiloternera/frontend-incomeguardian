import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PendingPeriod,
  PeriodClosingSettings,
  PeriodLog,
  PeriodMonth,
  PeriodRef,
  PeriodReview,
  PeriodYear,
  ReopenRequest,
} from '../domain/period';
import { PeriodRepository } from '../domain/period.repository';

/** Cuántos eventos del historial se muestran en Ajustes. */
export const PERIOD_HISTORY_LIMIT = 20;

@Injectable()
export class GetPeriodYearUseCase {
  private readonly repository = inject(PeriodRepository);

  execute(year: number): Observable<PeriodYear> {
    return this.repository.year(year);
  }
}

@Injectable()
export class GetPendingPeriodUseCase {
  private readonly repository = inject(PeriodRepository);

  execute(): Observable<PendingPeriod | null> {
    return this.repository.pending();
  }
}

@Injectable()
export class ReviewPeriodUseCase {
  private readonly repository = inject(PeriodRepository);

  execute(period: PeriodRef): Observable<PeriodReview> {
    return this.repository.review(period);
  }
}

@Injectable()
export class ClosePeriodUseCase {
  private readonly repository = inject(PeriodRepository);

  /** Cierra un mes, o el año completo cuando `month` es null. */
  execute(period: PeriodRef): Observable<PeriodMonth | PeriodYear> {
    return period.month === null
      ? this.repository.closeYear(period.year)
      : this.repository.closeMonth(period.year, period.month);
  }
}

@Injectable()
export class ReopenPeriodUseCase {
  private readonly repository = inject(PeriodRepository);

  /** Reabre un mes, o el año cuando `month` es null; un motivo vacío no se envía. */
  execute(period: PeriodRef, request: ReopenRequest): Observable<PeriodMonth | PeriodYear> {
    const reason = request.reason?.trim() || null;

    return period.month === null
      ? this.repository.reopenYear(period.year, reason)
      : this.repository.reopenMonth(period.year, period.month, { recloseMode: request.recloseMode, reason });
  }
}

@Injectable()
export class GetPeriodHistoryUseCase {
  private readonly repository = inject(PeriodRepository);

  execute(limit = PERIOD_HISTORY_LIMIT): Observable<PeriodLog[]> {
    return this.repository.history(limit);
  }
}

@Injectable()
export class GetPeriodSettingsUseCase {
  private readonly repository = inject(PeriodRepository);

  execute(): Observable<PeriodClosingSettings> {
    return this.repository.settings();
  }
}

@Injectable()
export class SavePeriodSettingsUseCase {
  private readonly repository = inject(PeriodRepository);

  execute(settings: PeriodClosingSettings): Observable<PeriodClosingSettings> {
    return this.repository.saveSettings(settings);
  }
}
