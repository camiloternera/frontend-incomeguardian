import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { GENERIC_ERROR_KEY, apiErrorCode, apiErrorData, resolveApiError } from '@core/http/api-error';
import {
  ExchangeRate,
  InstallmentPreview,
  InstallmentPreviewRequest,
  InstallmentScheduleItem,
  Transaction,
  TransactionAccountOption,
  TransactionCategoryOption,
  TransactionDraft,
  TransactionMonth,
  TransactionPage,
  TransactionQuery,
  TransactionRange,
  TransactionSummary,
  TransactionType,
  isTransactionType,
} from '../domain/transaction';
import { TransactionError, isTransactionErrorCode } from '../domain/transaction-error';
import {
  ExchangeRateRepository,
  TransactionAccountOptionsRepository,
  TransactionCategoryOptionsRepository,
  TransactionRepository,
} from '../domain/transaction.repository';
import { TRANSACTION_ERROR_KEYS, TRANSACTION_ERROR_PARAMS } from './transaction-error-messages';
import {
  ExchangeRateDto,
  InstallmentPreviewDto,
  InstallmentPreviewRequestDto,
  InstallmentScheduleItemDto,
  TransactionAccountOptionDto,
  TransactionCategoryOptionDto,
  TransactionDto,
  TransactionPageDto,
  TransactionRequestDto,
  TransactionSummaryDto,
} from './transaction.dto';

/** Respuesta con un valor que la app no conoce: se trata como inválida en vez de inventar uno. */
class InvalidResponseError extends Error {}

/** Identificador que usa el backend (`transactionTypeId`) para el tipo de movimiento de una categoría. */
const CATEGORY_TYPE_IDS: Record<TransactionType, number> = { income: 1, expense: 2, transfer: 3 };

const CATEGORY_TYPES_BY_ID = new Map<number, TransactionType>(
  Object.entries(CATEGORY_TYPE_IDS).map(([type, id]) => [id, type as TransactionType]),
);

/** Día `YYYY-MM-DD`: tal cual si ya lo es; si es un instante, el día en hora de Colombia. */
function toDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // `en-CA` formatea las fechas como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(value));
}

function toScheduleItem(dto: InstallmentScheduleItemDto): InstallmentScheduleItem {
  return {
    number: dto.number,
    year: dto.year,
    month: dto.month,
    statementDate: toDay(dto.statementDate),
    principal: dto.principal,
    interest: dto.interest,
    amount: dto.amount,
  };
}

function toPreview(dto: InstallmentPreviewDto): InstallmentPreview {
  return {
    installmentAmount: dto.installmentAmount,
    totalInterest: dto.totalInterest,
    totalAmount: dto.totalAmount,
    schedule: (dto.schedule ?? []).map(toScheduleItem),
    budgetAdjustments: (dto.budgetAdjustments ?? []).map((item) => ({
      year: item.year,
      month: item.month,
      categoryId: item.categoryId,
      currency: item.currency,
      currentAmount: item.currentAmount ?? null,
      newAmount: item.newAmount,
    })),
  };
}

/** Solo se envían la tasa y la categoría cuando hay. */
function toPreviewRequest(request: InstallmentPreviewRequest): InstallmentPreviewRequestDto {
  const body: InstallmentPreviewRequestDto = {
    fromAccountId: request.fromAccountId,
    amount: request.amount,
    date: request.date,
    installments: request.installments,
  };

  if (request.annualInterestRate !== null) {
    body.annualInterestRate = request.annualInterestRate;
  }
  if (request.categoryId !== null) {
    body.categoryId = request.categoryId;
  }

  return body;
}

function toTransaction(dto: TransactionDto): Transaction {
  if (!isTransactionType(dto.type)) {
    throw new InvalidResponseError(String(dto.type));
  }

  return {
    id: dto.id,
    type: dto.type,
    amount: dto.amount,
    date: dto.date,
    fromAccountId: dto.fromAccountId ?? null,
    toAccountId: dto.toAccountId ?? null,
    categoryId: dto.categoryId ?? null,
    description: dto.description ?? null,
    // El backend actual puede no enviar los campos de multimoneda todavía.
    fromCurrency: dto.fromCurrency ?? null,
    toCurrency: dto.toCurrency ?? null,
    destinationAmount: dto.destinationAmount ?? null,
    exchangeRate: dto.exchangeRate ?? null,
    exchangeRateDate: dto.exchangeRateDate ?? null,
    installments: dto.installments ?? 1,
    annualInterestRate: dto.annualInterestRate ?? null,
    installmentAmount: dto.installmentAmount ?? null,
    schedule: (dto.schedule ?? []).map(toScheduleItem),
    // Un backend que aún no envía el campo no bloquea nada: él sigue validando el mes cerrado.
    canModify: dto.canModify ?? true,
  };
}

function toPage(dto: TransactionPageDto): TransactionPage {
  return {
    items: dto.items.map(toTransaction),
    page: dto.page,
    pageSize: dto.pageSize,
    totalItems: dto.totalItems,
  };
}

function toSummary(dto: TransactionSummaryDto): TransactionSummary {
  return {
    totalItems: dto.totalItems,
    currencies: (dto.currencies ?? []).map((item) => ({
      currency: item.currency,
      income: item.income,
      expense: item.expense,
      transfersIn: item.transfersIn,
      transfersOut: item.transfersOut,
      net: item.net,
    })),
  };
}

/** Arma el cuerpo de creación con solo las cuentas que aplican al tipo y sin campos vacíos. */
function toRequest(draft: TransactionDraft): TransactionRequestDto {
  const body: TransactionRequestDto = { type: draft.type, amount: draft.amount, date: draft.date };

  if (draft.type !== 'income') {
    body.fromAccountId = draft.fromAccountId;
  }
  if (draft.type !== 'expense') {
    body.toAccountId = draft.toAccountId;
  }
  if (draft.categoryId !== null) {
    body.categoryId = draft.categoryId;
  }
  if (draft.description !== null) {
    body.description = draft.description;
  }
  // Una sola cuota es el valor por defecto: no se envía.
  if (draft.type === 'expense' && draft.installments !== undefined && draft.installments > 1) {
    body.installments = draft.installments;

    if (draft.annualInterestRate != null) {
      body.annualInterestRate = draft.annualInterestRate;
    }
  }

  return body;
}

/** Filtros del listado: solo se envían los que tienen valor. */
function toListParams(query: TransactionQuery): HttpParams {
  let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);

  // El backend interpreta las fechas como DateTime: se envían instantes UTC con `Z`.
  if (query.fromDate !== undefined) {
    params = params.set('fromDate', query.fromDate);
  }
  if (query.toDate !== undefined) {
    params = params.set('toDate', query.toDate);
  }

  return params;
}

/** El saldo actual cae al inicial mientras el backend no lo calcule. */
function toAccountOption(dto: TransactionAccountOptionDto): TransactionAccountOption {
  return {
    id: dto.id,
    name: dto.name,
    currency: dto.currency,
    currentBalance: dto.currentBalance ?? dto.initialBalance,
    isActive: dto.isActive,
    isCreditCard: dto.kind === 'credit_card',
    availableCredit: dto.availableCredit ?? null,
    nextStatementDate: dto.nextStatementDate ? toDay(dto.nextStatementDate) : null,
  };
}

/** Una categoría con un tipo desconocido conserva su nombre, pero no aplica a ningún movimiento. */
function toCategoryOption(dto: TransactionCategoryOptionDto): TransactionCategoryOption {
  return {
    id: dto.id,
    name: dto.name,
    type: CATEGORY_TYPES_BY_ID.get(dto.transactionTypeId) ?? null,
    isActive: dto.isActive !== false,
    code: dto.code ?? null,
  };
}

function toExchangeRate(dto: ExchangeRateDto): ExchangeRate {
  if (dto.base !== 'USD' || dto.quote !== 'COP') {
    throw new InvalidResponseError(`${dto.base}/${dto.quote}`);
  }

  return {
    base: 'USD',
    quote: 'COP',
    rate: dto.rate,
    validFrom: dto.validFrom,
    validTo: dto.validTo,
    source: dto.source,
  };
}

/** Extrae `data` del sobre de respuesta; un éxito sin `data` se trata como fallo. */
function unwrap<T>(): OperatorFunction<ApiResponse<T>, T> {
  return map((response) => {
    // Un 2xx es éxito salvo que el sobre diga lo contrario.
    if (!response?.isSuccess || response.data === null || response.data === undefined) {
      throw response;
    }

    return response.data;
  });
}

/** Convierte cualquier fallo del backend en un `TransactionError` traducido que conserva su código. */
function toTransactionError(error: unknown, transloco: TranslocoService): TransactionError {
  if (error instanceof InvalidResponseError) {
    return new TransactionError(transloco.translate(GENERIC_ERROR_KEY));
  }

  const code = apiErrorCode(error);
  const message = resolveApiError(error, TRANSACTION_ERROR_KEYS, (key) =>
    transloco.translate(key, TRANSACTION_ERROR_PARAMS),
  );

  return new TransactionError(message, isTransactionErrorCode(code) ? code : null, toMonth(apiErrorData(error)));
}

/** El mes de los datos de un error (`{ year, month }`), si lo trae. */
function toMonth(data: unknown): TransactionMonth | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const { year, month } = data as { year?: unknown; month?: unknown };

  return typeof year === 'number' && typeof month === 'number' ? { year, month } : null;
}

/** Operador común a los adaptadores: todo fallo sale como `TransactionError`. */
function toErrors<T>(transloco: TranslocoService): OperatorFunction<T, T> {
  return pipe(catchError((error: unknown) => throwError(() => toTransactionError(error, transloco))));
}

@Injectable()
export class TransactionHttpRepository extends TransactionRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/transactions`;

  list(query: TransactionQuery): Observable<TransactionPage> {
    return this.http
      .get<ApiResponse<TransactionPageDto>>(this.baseUrl, { params: toListParams(query) })
      .pipe(unwrap(), map(toPage), toErrors(this.transloco));
  }

  summary(range: TransactionRange): Observable<TransactionSummary> {
    const params = new HttpParams().set('fromDate', range.fromDate).set('toDate', range.toDate);

    return this.http
      .get<ApiResponse<TransactionSummaryDto>>(`${this.baseUrl}/summary`, { params })
      .pipe(unwrap(), map(toSummary), toErrors(this.transloco));
  }

  create(draft: TransactionDraft): Observable<Transaction> {
    return this.http
      .post<ApiResponse<TransactionDto>>(this.baseUrl, toRequest(draft))
      .pipe(unwrap(), map(toTransaction), toErrors(this.transloco));
  }

  get(id: number): Observable<Transaction> {
    return this.http
      .get<ApiResponse<TransactionDto>>(`${this.baseUrl}/${id}`)
      .pipe(unwrap(), map(toTransaction), toErrors(this.transloco));
  }

  update(id: number, draft: TransactionDraft): Observable<Transaction> {
    return this.http
      .put<ApiResponse<TransactionDto>>(`${this.baseUrl}/${id}`, toRequest(draft))
      .pipe(unwrap(), map(toTransaction), toErrors(this.transloco));
  }

  remove(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.baseUrl}/${id}`)
      .pipe(unwrap(), map(() => undefined), toErrors(this.transloco));
  }

  previewInstallments(request: InstallmentPreviewRequest): Observable<InstallmentPreview> {
    return this.http
      .post<ApiResponse<InstallmentPreviewDto>>(`${this.baseUrl}/installments/preview`, toPreviewRequest(request))
      .pipe(unwrap(), map(toPreview), toErrors(this.transloco));
  }
}

/** Lee las cuentas del usuario para los selectores del formulario; incluye las que no se pueden usar. */
@Injectable()
export class TransactionAccountOptionsHttpRepository extends TransactionAccountOptionsRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly url = `${environment.apiUrl}/api/v1/accounts`;

  list(): Observable<TransactionAccountOption[]> {
    return this.http.get<ApiResponse<TransactionAccountOptionDto[]>>(this.url).pipe(
      unwrap(),
      map((dtos) => dtos.map(toAccountOption)),
      toErrors(this.transloco),
    );
  }
}

/** Lee las categorías del usuario, filtradas por tipo de movimiento si se indica. */
@Injectable()
export class TransactionCategoryOptionsHttpRepository extends TransactionCategoryOptionsRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly url = `${environment.apiUrl}/api/v1/categories`;

  list(type?: TransactionType): Observable<TransactionCategoryOption[]> {
    const params = type ? new HttpParams().set('transactionTypeId', CATEGORY_TYPE_IDS[type]) : undefined;

    return this.http.get<ApiResponse<TransactionCategoryOptionDto[]>>(this.url, { params }).pipe(
      unwrap(),
      // Se conservan las desactivadas: el listado las necesita para nombrar movimientos antiguos.
      map((dtos) => dtos.map(toCategoryOption)),
      toErrors(this.transloco),
    );
  }
}

/** Lee la TRM oficial vigente para una fecha. */
@Injectable()
export class ExchangeRateHttpRepository extends ExchangeRateRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly url = `${environment.apiUrl}/api/v1/exchange-rates/trm`;

  trm(date?: string): Observable<ExchangeRate> {
    const params = date ? new HttpParams().set('date', date) : undefined;

    return this.http
      .get<ApiResponse<ExchangeRateDto>>(this.url, { params })
      .pipe(unwrap(), map(toExchangeRate), toErrors(this.transloco));
  }
}
