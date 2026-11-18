import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, concatMap, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { Cushion, CushionCandidate, CushionCurrency, CushionReason, sortCurrencies } from '../domain/cushion';
import { CushionRepository } from '../domain/cushion.repository';
import { DashboardError } from '../domain/dashboard-error';
import { toDashboardError } from './dashboard-api-error';
import { CushionAccountListItemDto, CushionCurrencyDto, CushionDto, CushionPreferencesDto } from './cushion.dto';

const REASONS: Record<string, CushionReason> = {
  NO_PREVIOUS_MONTHS: 'noPreviousMonths',
  NO_SPENDING: 'noSpending',
};

function toCurrency(dto: CushionCurrencyDto): CushionCurrency {
  const reason = dto.monthsCoveredReason ? (REASONS[dto.monthsCoveredReason] ?? null) : null;

  return {
    currency: dto.currency,
    savings: dto.savings,
    averageMonthlySpent: dto.averageMonthlySpent,
    monthsUsed: dto.monthsUsed,
    monthsCovered: dto.monthsCovered ?? null,
    // Sin meses calculados siempre hay un motivo, aunque llegue uno desconocido.
    reason: dto.monthsCovered === null || dto.monthsCovered === undefined ? (reason ?? 'noSpending') : null,
    goalAmount: dto.goalAmount ?? null,
    missing: dto.missing ?? null,
    accounts: (dto.accounts ?? []).map((account) => ({ id: account.id, name: account.name, balance: account.balance })),
  };
}

export function toCushion(dto: CushionDto): Cushion {
  return {
    goalMonths: dto.goalMonths,
    hasCushionAccounts: dto.hasCushionAccounts,
    currencies: sortCurrencies((dto.currencies ?? []).map(toCurrency)),
  };
}

/** Solo las cuentas activas que no son tarjeta de crédito se pueden elegir. */
export function toCandidates(dtos: CushionAccountListItemDto[]): CushionCandidate[] {
  return dtos
    .filter((dto) => dto.isActive && (dto.kind ?? 'standard') !== 'credit_card')
    .map((dto) => ({
      id: dto.id,
      name: dto.name,
      currency: dto.currency,
      balance: dto.currentBalance ?? dto.initialBalance,
      isCushion: dto.isCushion ?? false,
    }));
}

/** Lee y configura «Tu colchón» en el backend. */
@Injectable()
export class CushionHttpRepository extends CushionRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly api = `${environment.apiUrl}/api/v1`;

  cushion(): Observable<Cushion> {
    return this.http.get<ApiResponse<CushionDto>>(`${this.api}/dashboard/cushion`).pipe(this.unwrap(toCushion));
  }

  candidates(): Observable<CushionCandidate[]> {
    return this.http.get<ApiResponse<CushionAccountListItemDto[]>>(`${this.api}/accounts`).pipe(this.unwrap(toCandidates));
  }

  saveAccounts(accountIds: readonly number[]): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.api}/accounts/cushion`, { accountIds: [...accountIds] })
      .pipe(this.unwrap(() => undefined));
  }

  /** El backend reemplaza tema e idioma en el mismo PUT: se leen primero para no cambiarlos. */
  saveGoal(months: number): Observable<void> {
    const url = `${this.api}/User/preferences`;

    return this.http.get<ApiResponse<CushionPreferencesDto>>(url).pipe(
      this.unwrap((preferences) => preferences),
      concatMap((preferences) =>
        this.http
          .put<ApiResponse<CushionPreferencesDto>>(url, { theme: preferences.theme, language: preferences.language, cushionGoalMonths: months })
          .pipe(this.unwrap(() => undefined)),
      ),
    );
  }

  /** Extrae `data` del sobre y convierte cualquier fallo en un `DashboardError` traducido. */
  private unwrap<T, R>(mapper: (data: T) => R): OperatorFunction<ApiResponse<T>, R> {
    return pipe(
      map((response) => {
        // Un 2xx es éxito salvo que el sobre diga lo contrario.
        if (!response?.isSuccess || response.data === null || response.data === undefined) {
          throw response;
        }

        return mapper(response.data);
      }),
      catchError((error: unknown) =>
        throwError(() => (error instanceof DashboardError ? error : toDashboardError(error, (key) => this.transloco.translate(key)))),
      ),
    );
  }
}
