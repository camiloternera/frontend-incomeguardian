import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { GENERIC_ERROR_KEY, apiErrorCode, resolveApiError } from '@core/http/api-error';
import { Category, CategoryDraft, CategoryType, NewCategoryDraft } from '../domain/category';
import { CategoryError, isCategoryErrorCode } from '../domain/category-error';
import { CategoryRepository } from '../domain/category.repository';
import { CATEGORY_ERROR_KEYS, CATEGORY_ERROR_PARAMS } from './category-error-messages';
import { CategoryDto, CreateCategoryRequestDto, UpdateCategoryRequestDto } from './category.dto';

/** Identificador que usa el backend (`transactionTypeId`) para cada tipo de categoría. */
const TYPE_IDS: Record<CategoryType, number> = { income: 1, expense: 2, transfer: 3 };

const TYPES_BY_ID = new Map<number, CategoryType>(
  Object.entries(TYPE_IDS).map(([type, id]) => [id, type as CategoryType]),
);

/** Respuesta con un tipo que la app no conoce: se trata como inválida en vez de inventar uno. */
class InvalidResponseError extends Error {}

function toCategory(dto: CategoryDto): Category {
  const type = TYPES_BY_ID.get(dto.transactionTypeId);

  if (type === undefined) {
    throw new InvalidResponseError(String(dto.transactionTypeId));
  }

  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    type,
    isActive: dto.isActive,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function toCreateRequest(draft: NewCategoryDraft): CreateCategoryRequestDto {
  return { name: draft.name, description: draft.description, transactionTypeId: TYPE_IDS[draft.type] };
}

function toUpdateRequest(draft: CategoryDraft): UpdateCategoryRequestDto {
  return { name: draft.name, description: draft.description };
}

@Injectable()
export class CategoryHttpRepository extends CategoryRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/categories`;

  list(): Observable<Category[]> {
    return this.http
      .get<ApiResponse<CategoryDto[]>>(this.baseUrl, { params: { status: 'all' } })
      .pipe(
        // Una categoría de un tipo que la app no conoce no se puede usar: se omite sin tumbar la lista.
        this.unwrap((dtos) => dtos.filter((dto) => TYPES_BY_ID.has(dto.transactionTypeId)).map(toCategory)),
      );
  }

  get(id: number): Observable<Category> {
    return this.http.get<ApiResponse<CategoryDto>>(`${this.baseUrl}/${id}`).pipe(this.unwrap(toCategory));
  }

  create(draft: NewCategoryDraft): Observable<Category> {
    return this.http
      .post<ApiResponse<CategoryDto>>(this.baseUrl, toCreateRequest(draft))
      .pipe(this.unwrap(toCategory));
  }

  update(id: number, draft: CategoryDraft): Observable<Category> {
    return this.http
      .put<ApiResponse<CategoryDto>>(`${this.baseUrl}/${id}`, toUpdateRequest(draft))
      .pipe(this.unwrap(toCategory));
  }

  deactivate(id: number): Observable<Category> {
    return this.http
      .patch<ApiResponse<CategoryDto>>(`${this.baseUrl}/${id}/deactivate`, null)
      .pipe(this.unwrap(toCategory));
  }

  activate(id: number): Observable<Category> {
    return this.http
      .patch<ApiResponse<CategoryDto>>(`${this.baseUrl}/${id}/activate`, null)
      .pipe(this.unwrap(toCategory));
  }

  /**
   * Extrae `data` del sobre de respuesta, la convierte con `mapData` y transforma cualquier fallo
   * (incluida una respuesta con un tipo desconocido) en un `CategoryError`.
   */
  private unwrap<T, R>(mapData: (data: T) => R): OperatorFunction<ApiResponse<T>, R> {
    return pipe(
      map((response) => {
        // Un 2xx es éxito salvo que el sobre diga lo contrario.
        if (!response?.isSuccess || response.data === null) {
          throw response;
        }

        return mapData(response.data);
      }),
      catchError((error: unknown) => throwError(() => this.toError(error))),
    );
  }

  /** Traduce el error del backend y conserva su código para que presentation decida qué hacer. */
  private toError(error: unknown): CategoryError {
    if (error instanceof InvalidResponseError) {
      return new CategoryError(this.transloco.translate(GENERIC_ERROR_KEY));
    }

    const code = apiErrorCode(error);
    const message = resolveApiError(error, CATEGORY_ERROR_KEYS, (key) =>
      this.transloco.translate(key, CATEGORY_ERROR_PARAMS),
    );

    return new CategoryError(message, isCategoryErrorCode(code) ? code : null);
  }
}
