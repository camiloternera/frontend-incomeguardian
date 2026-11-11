import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, forkJoin, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { GENERIC_ERROR_KEY, apiErrorCode, resolveApiError } from '@core/http/api-error';
import {
  BudgetCategoryOption,
  BudgetCategoryType,
  BudgetKey,
  BudgetMonth,
  BudgetMovement,
  BudgetRow,
  BudgetSource,
  BudgetSummary,
  BUDGET_TIME_ZONE,
} from '../domain/budget';
import { BudgetError, isBudgetErrorCode } from '../domain/budget-error';
import {
  BudgetCategoryOptionsRepository,
  BudgetMovementsRepository,
  BudgetRepository,
  BudgetTarget,
} from '../domain/budget.repository';
import { BUDGET_ERROR_KEYS } from './budget-error-messages';
import {
  BudgetAccountDto,
  BudgetCategoryOptionDto,
  BudgetRowDto,
  BudgetTransactionPageDto,
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
    monthAmount: dto.monthAmount ?? null,
    installmentsRaise: dto.installmentsRaise ?? 0,
    installmentsSpent: dto.installmentsSpent ?? 0,
    installments: (dto.installments ?? []).map((item) => ({
      transactionId: item.transactionId,
      description: item.description ?? null,
      number: item.number,
      installments: item.installments,
      accountId: item.accountId,
      accountName: item.accountName,
      purchaseDate: toDay(item.purchaseDate),
      amount: item.amount,
      budgetAdjustment: item.budgetAdjustment ?? 0,
    })),
  };
}

/** Día `YYYY-MM-DD`: tal cual si ya lo es; si es un instante, el día en hora de Colombia. */
function toDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // `en-CA` formatea las fechas como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUDGET_TIME_ZONE }).format(new Date(value));
}

/** Desfase de Colombia respecto a UTC, en horas; no tiene horario de verano. */
const TIME_ZONE_OFFSET_HOURS = -5;

/** Rango de instantes UTC del mes completo en hora de Colombia; ambos límites incluidos. */
function monthRange({ year, month }: BudgetMonth): { fromDate: string; toDate: string } {
  const start = Date.UTC(year, month - 1, 1, -TIME_ZONE_OFFSET_HOURS);
  const next = Date.UTC(year, month, 1, -TIME_ZONE_OFFSET_HOURS);

  return { fromDate: new Date(start).toISOString(), toDate: new Date(next - 1).toISOString() };
}

/** Movimientos que se piden de una vez para «Lo que cuenta este mes». */
const MOVEMENTS_PAGE_SIZE = 50;

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
      installmentsSpent: total.installmentsSpent ?? 0,
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

/**
 * Lee los gastos de una categoría en el mes y deja solo los de cuentas normales en la moneda pedida:
 * las compras con tarjeta cuentan por cuota y ya llegan en el resumen. El backend no filtra por tipo
 * de cuenta, así que se cruzan con las cuentas.
 */
@Injectable()
export class BudgetMovementsHttpRepository extends BudgetMovementsRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly transactionsUrl = `${environment.apiUrl}/api/v1/transactions`;
  private readonly accountsUrl = `${environment.apiUrl}/api/v1/accounts`;

  list(month: BudgetMonth, key: BudgetKey, type: BudgetCategoryType): Observable<BudgetMovement[]> {
    const range = monthRange(month);
    const params = new HttpParams()
      .set('page', 1)
      .set('pageSize', MOVEMENTS_PAGE_SIZE)
      .set('fromDate', range.fromDate)
      .set('toDate', range.toDate)
      .set('categoryId', key.categoryId)
      .set('type', type);

    return forkJoin({
      page: this.http.get<ApiResponse<BudgetTransactionPageDto>>(this.transactionsUrl, { params }).pipe(unwrap()),
      accounts: this.http.get<ApiResponse<BudgetAccountDto[]>>(this.accountsUrl).pipe(unwrap()),
    }).pipe(
      map(({ page, accounts }) => {
        const byId = new Map(accounts.map((account) => [account.id, account]));

        return (page.items ?? []).flatMap((item): BudgetMovement[] => {
          const account = item.fromAccountId === null ? undefined : byId.get(item.fromAccountId);

          if (!account || account.kind === 'credit_card' || account.currency !== key.currency) {
            return [];
          }

          return [
            {
              transactionId: item.id,
              description: item.description ?? null,
              accountName: account.name,
              date: item.date,
              amount: item.amount,
            },
          ];
        });
      }),
      toErrors(this.transloco),
    );
  }
}
