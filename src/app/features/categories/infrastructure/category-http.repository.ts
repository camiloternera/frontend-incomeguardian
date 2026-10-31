import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { apiErrorCode, resolveApiError } from '@core/http/api-error';
import { Category, CategoryDraft } from '../domain/category';
import { CategoryError, isCategoryErrorCode } from '../domain/category-error';
import { CategoryRepository } from '../domain/category.repository';
import { CATEGORY_ERROR_KEYS, CATEGORY_ERROR_PARAMS } from './category-error-messages';
import { CategoryDto, CategoryRequestDto } from './category.dto';

function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    isGlobal: dto.isGlobal,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function toRequest(draft: CategoryDraft): CategoryRequestDto {
  return { name: draft.name, description: draft.description };
}

@Injectable()
export class CategoryHttpRepository extends CategoryRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/categories`;

  list(): Observable<Category[]> {
    return this.http
      .get<ApiResponse<CategoryDto[]>>(this.baseUrl)
      .pipe(this.unwrap(), map((dtos) => dtos.map(toCategory)));
  }

  get(id: number): Observable<Category> {
    return this.http.get<ApiResponse<CategoryDto>>(`${this.baseUrl}/${id}`).pipe(this.unwrap(), map(toCategory));
  }

  create(draft: CategoryDraft): Observable<Category> {
    return this.http
      .post<ApiResponse<CategoryDto>>(this.baseUrl, toRequest(draft))
      .pipe(this.unwrap(), map(toCategory));
  }

  update(id: number, draft: CategoryDraft): Observable<Category> {
    return this.http
      .put<ApiResponse<CategoryDto>>(`${this.baseUrl}/${id}`, toRequest(draft))
      .pipe(this.unwrap(), map(toCategory));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<ApiResponse<boolean>>(`${this.baseUrl}/${id}`).pipe(
      this.unwrap(),
      map(() => undefined),
    );
  }

  /** Extrae `data` del sobre de respuesta y convierte cualquier fallo en un `CategoryError`. */
  private unwrap<T>(): OperatorFunction<ApiResponse<T>, T> {
    return pipe(
      map((response) => {
        // Un 2xx es éxito salvo que el sobre diga lo contrario.
        if (!response?.isSuccess || response.data === null) {
          throw response;
        }

        return response.data;
      }),
      catchError((error: unknown) => throwError(() => this.toError(error))),
    );
  }

  /** Traduce el error del backend y conserva su código para que presentation decida qué hacer. */
  private toError(error: unknown): CategoryError {
    const code = apiErrorCode(error);
    const message = resolveApiError(error, CATEGORY_ERROR_KEYS, (key) =>
      this.transloco.translate(key, CATEGORY_ERROR_PARAMS),
    );

    return new CategoryError(message, isCategoryErrorCode(code) ? code : null);
  }
}
