import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { GENERIC_ERROR_KEY, apiErrorCode, resolveApiError } from '@core/http/api-error';
import { Account, AccountDraft, isCurrency } from '../domain/account';
import { AccountError, isAccountErrorCode } from '../domain/account-error';
import { AccountRepository } from '../domain/account.repository';
import { ACCOUNT_ERROR_KEYS, ACCOUNT_ERROR_PARAMS } from './account-error-messages';
import { AccountDto, AccountRequestDto } from './account.dto';

/** Moneda que la app no conoce: se trata como respuesta inválida en vez de inventar una. */
class UnknownCurrencyError extends Error {}

function toAccount(dto: AccountDto): Account {
  if (!isCurrency(dto.currency)) {
    throw new UnknownCurrencyError(String(dto.currency));
  }

  return {
    id: dto.id,
    name: dto.name,
    initialBalance: dto.initialBalance,
    // Mientras el backend no lo informe, el saldo actual es el inicial.
    currentBalance: dto.currentBalance ?? dto.initialBalance,
    currency: dto.currency,
    isActive: dto.isActive,
    openingDate: dto.openingDate,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function toRequest(draft: AccountDraft): AccountRequestDto {
  return {
    name: draft.name,
    initialBalance: draft.initialBalance,
    currency: draft.currency,
    openingDate: draft.openingDate,
  };
}

/**
 * Extrae `data` del sobre de respuesta. `requireData` en false acepta un éxito sin `data`,
 * como el de la desactivación.
 */
function unwrap<T>(requireData = true): OperatorFunction<ApiResponse<T>, T> {
  return map((response) => {
    // Un 2xx es éxito salvo que el sobre diga lo contrario.
    if (!response?.isSuccess || (requireData && response.data === null)) {
      throw response;
    }

    // Solo llega null cuando `requireData` es false, y ese llamador descarta el valor.
    return response.data as T;
  });
}

/** Convierte cualquier fallo del backend en un `AccountError` traducido que conserva su código. */
function toAccountError(error: unknown, transloco: TranslocoService): AccountError {
  if (error instanceof UnknownCurrencyError) {
    return new AccountError(transloco.translate(GENERIC_ERROR_KEY));
  }

  const code = apiErrorCode(error);
  const message = resolveApiError(error, ACCOUNT_ERROR_KEYS, (key) => transloco.translate(key, ACCOUNT_ERROR_PARAMS));

  return new AccountError(message, isAccountErrorCode(code) ? code : null);
}

@Injectable()
export class AccountHttpRepository extends AccountRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/accounts`;

  list(): Observable<Account[]> {
    return this.http.get<ApiResponse<AccountDto[]>>(this.baseUrl).pipe(
      unwrap(),
      map((dtos) => dtos.map(toAccount)),
      this.toErrors(),
    );
  }

  get(id: number): Observable<Account> {
    return this.http.get<ApiResponse<AccountDto>>(`${this.baseUrl}/${id}`).pipe(unwrap(), map(toAccount), this.toErrors());
  }

  create(draft: AccountDraft): Observable<Account> {
    return this.http
      .post<ApiResponse<AccountDto>>(this.baseUrl, toRequest(draft))
      .pipe(unwrap(), map(toAccount), this.toErrors());
  }

  update(id: number, draft: AccountDraft): Observable<Account> {
    return this.http
      .put<ApiResponse<AccountDto>>(`${this.baseUrl}/${id}`, toRequest(draft))
      .pipe(unwrap(), map(toAccount), this.toErrors());
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/${id}`).pipe(
      unwrap(false),
      map(() => undefined),
      this.toErrors(),
    );
  }

  private toErrors<T>(): OperatorFunction<T, T> {
    return pipe(catchError((error: unknown) => throwError(() => toAccountError(error, this.transloco))));
  }
}
