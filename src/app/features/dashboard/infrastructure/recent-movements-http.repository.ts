import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { RecentMovement, dayInDashboardZone, isRecentMovementKind } from '../domain/recent-movement';
import { RecentMovementsRepository } from '../domain/recent-movements.repository';
import { toDashboardError } from './dashboard-api-error';
import { RecentMovementDto } from './recent-movements.dto';

/** Un movimiento de un tipo desconocido no se puede pintar: se descarta en vez de inventarle uno. */
function toMovements(dtos: RecentMovementDto[]): RecentMovement[] {
  return dtos.flatMap((dto) => {
    if (!isRecentMovementKind(dto.type)) {
      return [];
    }

    const hasDestination =
      dto.type === 'transfer' &&
      dto.destinationAmount !== null &&
      dto.destinationAmount !== undefined &&
      !!dto.destinationCurrency &&
      dto.destinationCurrency !== dto.currency;

    return [
      {
        id: dto.id,
        kind: dto.type,
        date: dto.date,
        day: dayInDashboardZone(dto.date),
        description: dto.description?.trim() || null,
        amount: dto.amount,
        currency: dto.currency,
        categoryName: dto.categoryName ?? null,
        isCardPayment: dto.isCardPayment ?? false,
        isCardAdvance: dto.isCardAdvance ?? false,
        isAdvanceFee: dto.isAdvanceFee ?? false,
        installments: dto.installmentCount ?? 1,
        fromAccountName: dto.fromAccountName ?? null,
        toAccountName: dto.toAccountName ?? null,
        destination: hasDestination ? { amount: dto.destinationAmount!, currency: dto.destinationCurrency! } : null,
      },
    ];
  });
}

/** Lee los últimos movimientos del Resumen desde el backend. */
@Injectable()
export class RecentMovementsHttpRepository extends RecentMovementsRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly url = `${environment.apiUrl}/api/v1/dashboard/recent`;

  recent(limit: number): Observable<RecentMovement[]> {
    const params = new HttpParams().set('limit', limit);

    return this.http.get<ApiResponse<RecentMovementDto[]>>(this.url, { params }).pipe(
      map((response) => {
        // Un 2xx es éxito salvo que el sobre diga lo contrario.
        if (!response?.isSuccess || response.data === null || response.data === undefined) {
          throw response;
        }

        return toMovements(response.data);
      }),
      catchError((error: unknown) => throwError(() => toDashboardError(error, (key) => this.transloco.translate(key)))),
    );
  }
}
