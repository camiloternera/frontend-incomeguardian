import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { apiErrorCode, resolveApiError } from '@core/http/api-error';
import { AccountType, AccountTypeDraft } from '../domain/account-type';
import { AccountTypeError, isAccountTypeErrorCode } from '../domain/account-type-error';
import { AccountTypeRepository } from '../domain/account-type.repository';
import { ACCOUNT_TYPE_ERROR_KEYS, ACCOUNT_TYPE_ERROR_PARAMS } from './account-type-error-messages';
import { AccountTypeDto, AccountTypeRequestDto } from './account-type.dto';

function toAccountType(dto: AccountTypeDto): AccountType {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function toRequest(draft: AccountTypeDraft): AccountTypeRequestDto {
  return { name: draft.name, description: draft.description };
}

@Injectable()
export class AccountTypeHttpRepository extends AccountTypeRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/account-types`;

  list(): Observable<AccountType[]> {
    return this.http
      .get<ApiResponse<AccountTypeDto[]>>(this.baseUrl)
      .pipe(this.unwrap(), map((dtos) => dtos.map(toAccountType)));
  }

  get(id: number): Observable<AccountType> {
    return this.http.get<ApiResponse<AccountTypeDto>>(`${this.baseUrl}/${id}`).pipe(this.unwrap(), map(toAccountType));
  }

  create(draft: AccountTypeDraft): Observable<AccountType> {
    return this.http
      .post<ApiResponse<AccountTypeDto>>(this.baseUrl, toRequest(draft))
      .pipe(this.unwrap(), map(toAccountType));
  }

  update(id: number, draft: AccountTypeDraft): Observable<AccountType> {
    return this.http
      .put<ApiResponse<AccountTypeDto>>(`${this.baseUrl}/${id}`, toRequest(draft))
      .pipe(this.unwrap(), map(toAccountType));
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/${id}`).pipe(
      this.unwrap(false),
      map(() => undefined),
    );
  }

  /**
   * Extrae `data` del sobre de respuesta y convierte cualquier fallo en un `AccountTypeError`.
   * `requireData` en false acepta un éxito sin `data`, como el de la desactivación.
   */
  private unwrap<T>(requireData = true): OperatorFunction<ApiResponse<T>, T> {
    return pipe(
      map((response) => {
        // Un 2xx es éxito salvo que el sobre diga lo contrario.
        if (!response?.isSuccess || (requireData && response.data === null)) {
          throw response;
        }

        // Solo llega null cuando `requireData` es false, y ese llamador descarta el valor.
        return response.data as T;
      }),
      catchError((error: unknown) => throwError(() => this.toError(error))),
    );
  }

  /** Traduce el error del backend y conserva su código para que presentation decida qué hacer. */
  private toError(error: unknown): AccountTypeError {
    const code = apiErrorCode(error);
    const message = resolveApiError(error, ACCOUNT_TYPE_ERROR_KEYS, (key) =>
      this.transloco.translate(key, ACCOUNT_TYPE_ERROR_PARAMS),
    );

    return new AccountTypeError(message, isAccountTypeErrorCode(code) ? code : null);
  }
}
