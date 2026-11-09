import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { GENERIC_ERROR_KEY, apiErrorCode, resolveApiError } from '@core/http/api-error';
import {
  PendingPeriod,
  PeriodAccountBalance,
  PeriodClosingSettings,
  PeriodLog,
  PeriodMonth,
  PeriodMonthStatus,
  PeriodRef,
  PeriodReview,
  PeriodTotals,
  PeriodYear,
  RecloseMode,
  ReopenRequest,
} from '../domain/period';
import { PeriodError, isPeriodErrorCode } from '../domain/period-error';
import { PeriodRepository } from '../domain/period.repository';
import { PERIOD_ERROR_KEYS, PERIOD_ERROR_PARAMS } from './period-error-messages';
import {
  MonthReviewDto,
  PendingPeriodDto,
  PeriodAccountBalanceDto,
  PeriodClosingSettingsDto,
  PeriodLogDto,
  PeriodMonthDto,
  PeriodTotalsDto,
  PeriodYearDto,
  ReopenMonthRequestDto,
  ReopenYearRequestDto,
  YearReviewDto,
} from './period.dto';

const STATUSES: readonly PeriodMonthStatus[] = ['closed', 'pending', 'current', 'future', 'noActivity'];

/** Respuesta con un valor que la app no conoce: se trata como inválida en vez de inventar uno. */
class InvalidResponseError extends Error {}

function toStatus(value: string): PeriodMonthStatus {
  if (!STATUSES.includes(value as PeriodMonthStatus)) {
    throw new InvalidResponseError(value);
  }

  return value as PeriodMonthStatus;
}

function toRecloseMode(value: string | null): RecloseMode | null {
  return value === 'auto' || value === 'manual' ? value : null;
}

function toMonth(dto: PeriodMonthDto): PeriodMonth {
  return {
    month: dto.month,
    status: toStatus(dto.status),
    closedAt: dto.closedAt,
    closedAutomatically: dto.closedAutomatically,
    reopenedAt: dto.reopenedAt,
    recloseMode: toRecloseMode(dto.recloseMode),
    recloseAt: dto.recloseAt,
    autoCloseOn: dto.autoCloseOn,
    canClose: dto.canClose,
    canReopen: dto.canReopen,
  };
}

function toYear(dto: PeriodYearDto): PeriodYear {
  return {
    year: dto.year,
    yearClosed: dto.yearClosed,
    yearClosedAt: dto.yearClosedAt,
    yearClosedAutomatically: dto.yearClosedAutomatically,
    canCloseYear: dto.canCloseYear,
    canReopenYear: dto.canReopenYear,
    firstActivity: dto.firstActivity,
    months: [...dto.months].sort((a, b) => a.month - b.month).map(toMonth),
  };
}

function toTotals(dto: PeriodTotalsDto): PeriodTotals {
  return { ...dto };
}

function toBalance(dto: PeriodAccountBalanceDto): PeriodAccountBalance {
  return { ...dto };
}

function toMonthReview(dto: MonthReviewDto): PeriodReview {
  return {
    year: dto.year,
    month: dto.state.month,
    monthState: toMonth(dto.state),
    yearState: null,
    totals: dto.totals.map(toTotals),
    balances: dto.balances.map(toBalance),
    uncategorizedCount: dto.uncategorizedCount,
  };
}

function toYearReview(dto: YearReviewDto): PeriodReview {
  return {
    year: dto.state.year,
    month: null,
    monthState: null,
    yearState: toYear(dto.state),
    totals: dto.totals.map(toTotals),
    balances: dto.balances.map(toBalance),
    uncategorizedCount: dto.uncategorizedCount,
  };
}

function toPending(dto: PendingPeriodDto | null): PendingPeriod | null {
  return dto ? { ...dto } : null;
}

function toLog(dto: PeriodLogDto): PeriodLog {
  if (dto.action !== 'close' && dto.action !== 'reopen') {
    throw new InvalidResponseError(dto.action);
  }

  return {
    year: dto.year,
    month: dto.month === 0 ? null : dto.month,
    action: dto.action,
    automatic: dto.automatic,
    reason: dto.reason,
    createdAt: dto.createdAt,
  };
}

function toSettings(dto: PeriodClosingSettingsDto): PeriodClosingSettings {
  return { ...dto };
}

@Injectable()
export class PeriodHttpRepository extends PeriodRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/periods`;

  year(year: number): Observable<PeriodYear> {
    return this.http
      .get<ApiResponse<PeriodYearDto>>(this.baseUrl, { params: { year } })
      .pipe(this.unwrap(toYear));
  }

  pending(): Observable<PendingPeriod | null> {
    // `data: null` es una respuesta válida: no hay mes pendiente.
    return this.http.get<ApiResponse<PendingPeriodDto>>(`${this.baseUrl}/pending`).pipe(this.unwrap(toPending, true));
  }

  review(period: PeriodRef): Observable<PeriodReview> {
    if (period.month === null) {
      return this.http
        .get<ApiResponse<YearReviewDto>>(`${this.baseUrl}/${period.year}/review`)
        .pipe(this.unwrap(toYearReview));
    }

    return this.http
      .get<ApiResponse<MonthReviewDto>>(`${this.baseUrl}/${period.year}/${period.month}/review`)
      .pipe(this.unwrap(toMonthReview));
  }

  closeMonth(year: number, month: number): Observable<PeriodMonth> {
    return this.http
      .post<ApiResponse<PeriodMonthDto>>(`${this.baseUrl}/${year}/${month}/close`, null)
      .pipe(this.unwrap(toMonth));
  }

  reopenMonth(year: number, month: number, request: ReopenRequest): Observable<PeriodMonth> {
    const body: ReopenMonthRequestDto = { recloseMode: request.recloseMode ?? 'auto', reason: request.reason };

    return this.http
      .post<ApiResponse<PeriodMonthDto>>(`${this.baseUrl}/${year}/${month}/reopen`, body)
      .pipe(this.unwrap(toMonth));
  }

  closeYear(year: number): Observable<PeriodYear> {
    return this.http.post<ApiResponse<PeriodYearDto>>(`${this.baseUrl}/${year}/close`, null).pipe(this.unwrap(toYear));
  }

  reopenYear(year: number, reason: string | null): Observable<PeriodYear> {
    const body: ReopenYearRequestDto = { reason };

    return this.http.post<ApiResponse<PeriodYearDto>>(`${this.baseUrl}/${year}/reopen`, body).pipe(this.unwrap(toYear));
  }

  history(limit: number): Observable<PeriodLog[]> {
    return this.http
      .get<ApiResponse<PeriodLogDto[]>>(`${this.baseUrl}/history`, { params: { limit } })
      .pipe(this.unwrap((dtos) => dtos.map(toLog)));
  }

  settings(): Observable<PeriodClosingSettings> {
    return this.http
      .get<ApiResponse<PeriodClosingSettingsDto>>(`${this.baseUrl}/settings`)
      .pipe(this.unwrap(toSettings));
  }

  saveSettings(settings: PeriodClosingSettings): Observable<PeriodClosingSettings> {
    const body: PeriodClosingSettingsDto = { ...settings };

    return this.http
      .put<ApiResponse<PeriodClosingSettingsDto>>(`${this.baseUrl}/settings`, body)
      .pipe(this.unwrap(toSettings));
  }

  /**
   * Extrae `data` del sobre de respuesta, la convierte con `mapData` y transforma cualquier fallo
   * en un `PeriodError`. Con `allowNull`, un `data: null` exitoso también es válido.
   */
  private unwrap<T, R>(mapData: (data: T) => R, allowNull = false): OperatorFunction<ApiResponse<T>, R> {
    return pipe(
      map((response) => {
        if (!response?.isSuccess || (response.data === null && !allowNull)) {
          throw response;
        }

        return mapData(response.data as T);
      }),
      catchError((error: unknown) => throwError(() => this.toError(error))),
    );
  }

  /** Traduce el error del backend y conserva su código para que presentation decida qué hacer. */
  private toError(error: unknown): PeriodError {
    if (error instanceof InvalidResponseError) {
      return new PeriodError(this.transloco.translate(GENERIC_ERROR_KEY));
    }

    const code = apiErrorCode(error);
    const message = resolveApiError(error, PERIOD_ERROR_KEYS, (key) =>
      this.transloco.translate(key, PERIOD_ERROR_PARAMS),
    );

    return new PeriodError(message, isPeriodErrorCode(code) ? code : null);
  }
}
