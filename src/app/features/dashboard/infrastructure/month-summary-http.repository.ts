import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { apiErrorCode, resolveApiError } from '@core/http/api-error';
import { DashboardError, DashboardErrorCode } from '../domain/dashboard-error';
import { CategorySpent, MonthSummary, SummaryMonth } from '../domain/month-summary';
import { MonthSummaryRepository } from '../domain/month-summary.repository';
import { CategorySpentDto, MonthSummaryDto } from './month-summary.dto';

/** Cada código conocido del backend para el Resumen, asociado a su clave de traducción. */
const DASHBOARD_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(DashboardErrorCode).map((code) => [code, `dashboard.errors.${code}`]),
);

const KNOWN_CODES: readonly string[] = Object.values(DashboardErrorCode);

/** Una categoría con un tipo desconocido no suma al gasto: se descarta en vez de inventarle uno. */
function toCategories(dtos: CategorySpentDto[]): CategorySpent[] {
  return dtos.flatMap((dto) =>
    dto.type === 'expense' || dto.type === 'transfer'
      ? [{ categoryId: dto.categoryId, name: dto.name, type: dto.type, spent: dto.spent }]
      : [],
  );
}

function toSummary(dto: MonthSummaryDto): MonthSummary {
  return {
    year: dto.year,
    month: dto.month,
    currencies: (dto.currencies ?? []).map((item) => ({
      currency: item.currency,
      income: item.income,
      incomePayments: item.incomePayments,
      spent: item.spent,
      committed: item.committed,
      history: (item.history ?? []).map((point) => ({
        year: point.year,
        month: point.month,
        income: point.income,
        spent: point.spent,
      })),
      categories: toCategories(item.categories ?? []),
    })),
  };
}

/** Lee las cifras del mes del Resumen desde el backend. */
@Injectable()
export class MonthSummaryHttpRepository extends MonthSummaryRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly url = `${environment.apiUrl}/api/v1/dashboard/summary`;

  summary({ year, month }: SummaryMonth): Observable<MonthSummary> {
    const params = new HttpParams().set('year', year).set('month', month);

    return this.http.get<ApiResponse<MonthSummaryDto>>(this.url, { params }).pipe(
      map((response) => {
        // Un 2xx es éxito salvo que el sobre diga lo contrario.
        if (!response?.isSuccess || response.data === null || response.data === undefined) {
          throw response;
        }

        return toSummary(response.data);
      }),
      catchError((error: unknown) => throwError(() => this.toError(error))),
    );
  }

  /** Convierte cualquier fallo en un `DashboardError` traducido que conserva su código. */
  private toError(error: unknown): DashboardError {
    const code = apiErrorCode(error);
    const message = resolveApiError(error, DASHBOARD_ERROR_KEYS, (key) => this.transloco.translate(key));

    return new DashboardError(message, code !== undefined && KNOWN_CODES.includes(code) ? (code as DashboardErrorCode) : null);
  }
}
