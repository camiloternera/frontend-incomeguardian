import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { GENERIC_ERROR_KEY, apiErrorCode, resolveApiError } from '@core/http/api-error';
import {
  BudgetCategoryOption,
  BudgetCategoryType,
  BudgetKey,
  BudgetMonth,
  BudgetRow,
  BudgetSource,
  BudgetSummary,
} from '../domain/budget';
import { BudgetError, isBudgetErrorCode } from '../domain/budget-error';
import { BudgetCategoryOptionsRepository, BudgetRepository, BudgetTarget } from '../domain/budget.repository';
import { BUDGET_ERROR_KEYS } from './budget-error-messages';
import {
  BudgetCategoryOptionDto,
  BudgetRowDto,
  BudgetSummaryDto,
  MonthBudgetRequestDto,
  RecurringBudgetRequestDto,
} from './budget.dto';

/** Identificador que usa el backend (`transactionTypeId`) para los tipos que admiten tope. */
const TYPES_BY_ID = new Map<number, BudgetCategoryType>([
  [2, 'expense'],
  [3, 'transfer'],
]);

const SOURCES: readonly BudgetSource[] = ['recurring', 'month', 'none'];

/** Respuesta con un valor que la app no conoce: se trata como inválida en vez de inventar uno. */
class InvalidResponseError extends Error {}

function toRow(dto: BudgetRowDto): BudgetRow {
  const source = SOURCES.find((item) => item === dto.source);

  if (source === undefined) {
    throw new InvalidResponseError(String(dto.source));
  }

  return {
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    categoryType: TYPES_BY_ID.get(dto.categoryTypeId) ?? null,
    currency: dto.currency,
    budgetAmount: dto.budgetAmount,
    spentAmount: dto.spentAmount,
    availableAmount: dto.availableAmount,
    percentUsed: dto.percentUsed ?? null,
    recurringAmount: dto.recurringAmount ?? null,
    source,
  };
}

function toSummary(dto: BudgetSummaryDto): BudgetSummary {
  return {
    year: dto.year,
    month: dto.month,
    isClosed: dto.isClosed,
    rows: (dto.rows ?? []).map(toRow),
    totals: (dto.totals ?? []).map((total) => ({
      currency: total.currency,
      budget: total.budget,
      spent: total.spent,
      available: total.available,
    })),
  };
}

function toCategoryOption(dto: BudgetCategoryOptionDto): BudgetCategoryOption {
  return {
    id: dto.id,
    name: dto.name,
    type: TYPES_BY_ID.get(dto.transactionTypeId) ?? null,
    isActive: dto.isActive !== false,
  };
}

/** Extrae `data` del sobre de respuesta; un éxito sin `data` se trata como fallo. */
function unwrap<T>(): OperatorFunction<ApiResponse<T>, T> {
  return map((response) => {
    if (!response?.isSuccess || response.data === null || response.data === undefined) {
      throw response;
    }

    return response.data;
  });
}

/** Para las escrituras solo importa que el sobre diga éxito; `data` no se usa. */
function unwrapVoid(): OperatorFunction<ApiResponse<unknown> | null, void> {
  return map((response) => {
    // Un 204 sin cuerpo también es éxito.
    if (response !== null && !response.isSuccess) {
      throw response;
    }
  });
}

/** Convierte cualquier fallo del backend en un `BudgetError` traducido que conserva su código. */
function toBudgetError(error: unknown, transloco: TranslocoService): BudgetError {
  if (error instanceof InvalidResponseError) {
    return new BudgetError(transloco.translate(GENERIC_ERROR_KEY));
  }

  const code = apiErrorCode(error);
  const message = resolveApiError(error, BUDGET_ERROR_KEYS, (key) => transloco.translate(key));

  return new BudgetError(message, isBudgetErrorCode(code) ? code : null);
}

function toErrors<T>(transloco: TranslocoService): OperatorFunction<T, T> {
  return pipe(catchError((error: unknown) => throwError(() => toBudgetError(error, transloco))));
}

@Injectable()
export class BudgetHttpRepository extends BudgetRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/budgets`;

  summary({ year, month }: BudgetMonth): Observable<BudgetSummary> {
    const params = new HttpParams().set('year', year).set('month', month);

    return this.http
      .get<ApiResponse<BudgetSummaryDto>>(`${this.baseUrl}/summary`, { params })
      .pipe(unwrap(), map(toSummary), toErrors(this.transloco));
  }

  saveRecurring(target: BudgetTarget, amount: number, from: BudgetMonth): Observable<void> {
    const body: RecurringBudgetRequestDto = {
      categoryId: target.categoryId,
      currency: target.currency,
      amount,
      fromYear: from.year,
      fromMonth: from.month,
    };

    return this.http
      .put<ApiResponse<unknown> | null>(`${this.baseUrl}/recurring`, body)
      .pipe(unwrapVoid(), toErrors(this.transloco));
  }

  removeRecurring(key: BudgetKey, from: BudgetMonth): Observable<void> {
    const params = new HttpParams()
      .set('currency', key.currency)
      .set('fromYear', from.year)
      .set('fromMonth', from.month);

    return this.http
      .delete<ApiResponse<unknown> | null>(`${this.baseUrl}/recurring/${key.categoryId}`, { params })
      .pipe(unwrapVoid(), toErrors(this.transloco));
  }

  saveMonth({ year, month }: BudgetMonth, target: BudgetTarget, amount: number): Observable<void> {
    const body: MonthBudgetRequestDto = { categoryId: target.categoryId, currency: target.currency, amount };

    return this.http
      .put<ApiResponse<unknown> | null>(`${this.baseUrl}/${year}/${month}`, body)
      .pipe(unwrapVoid(), toErrors(this.transloco));
  }

  removeMonth({ year, month }: BudgetMonth, key: BudgetKey): Observable<void> {
    const params = new HttpParams().set('currency', key.currency);

    return this.http
      .delete<ApiResponse<unknown> | null>(`${this.baseUrl}/${year}/${month}/${key.categoryId}`, { params })
      .pipe(unwrapVoid(), toErrors(this.transloco));
  }
}

/** Lee las categorías del usuario, activas y desactivadas. */
@Injectable()
export class BudgetCategoryOptionsHttpRepository extends BudgetCategoryOptionsRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly url = `${environment.apiUrl}/api/v1/categories`;

  list(): Observable<BudgetCategoryOption[]> {
    return this.http
      .get<ApiResponse<BudgetCategoryOptionDto[]>>(this.url, { params: { status: 'all' } })
      .pipe(
        unwrap(),
        map((dtos) => dtos.map(toCategoryOption)),
        toErrors(this.transloco),
      );
  }
}
