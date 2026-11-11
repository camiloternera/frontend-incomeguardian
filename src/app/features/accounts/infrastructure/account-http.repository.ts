import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { GENERIC_ERROR_KEY, apiErrorCode, resolveApiError } from '@core/http/api-error';
import { Account, AccountDraft, isAccountKind, isCurrency } from '../domain/account';
import { AccountError, isAccountErrorCode } from '../domain/account-error';
import { AccountRepository } from '../domain/account.repository';
import { CardStatement, isStatementStatus } from '../domain/card-statement';
import { CardMonth } from '../domain/credit-card-calendar';
import { ACCOUNT_ERROR_KEYS, ACCOUNT_ERROR_PARAMS } from './account-error-messages';
import { AccountDto, AccountRequestDto, StatementDto, StatementMonthDto } from './account.dto';

/** Valor que la app no conoce (moneda, tipo o estado): se trata como respuesta inválida en vez de inventarlo. */
class UnknownCurrencyError extends Error {}

/** Zona horaria en la que el backend decide los días de corte y de compra. */
const CARD_TIME_ZONE = 'America/Bogota';

/** Día `YYYY-MM-DD`: tal cual si ya lo es; si es un instante, el día en hora de Colombia. */
function toDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // `en-CA` formatea las fechas como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', { timeZone: CARD_TIME_ZONE }).format(new Date(value));
}

function toAccount(dto: AccountDto): Account {
  if (!isCurrency(dto.currency)) {
    throw new UnknownCurrencyError(String(dto.currency));
  }

  // Sin `kind` (backend anterior a las tarjetas) la cuenta es normal.
  const kind = dto.kind ?? 'standard';

  if (!isAccountKind(kind)) {
    throw new UnknownCurrencyError(String(kind));
  }

  return {
    id: dto.id,
    name: dto.name,
    kind,
    initialBalance: dto.initialBalance,
    // Mientras el backend no lo informe, el saldo actual es el inicial.
    currentBalance: dto.currentBalance ?? dto.initialBalance,
    currency: dto.currency,
    isActive: dto.isActive,
    hasTransactions: dto.hasTransactions ?? false,
    openingDate: dto.openingDate,
    creditLimit: dto.creditLimit ?? null,
    statementDay: dto.statementDay ?? null,
    paymentDay: dto.paymentDay ?? null,
    availableCredit: dto.availableCredit ?? null,
    nextStatementDate: dto.nextStatementDate ? toDay(dto.nextStatementDate) : null,
    nextPaymentDueDate: dto.nextPaymentDueDate ? toDay(dto.nextPaymentDueDate) : null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

/** Los campos de tarjeta solo se envían en una tarjeta, y el cupo solo si se registró. */
function toRequest(draft: AccountDraft): AccountRequestDto {
  const body: AccountRequestDto = {
    name: draft.name,
    kind: draft.kind,
    initialBalance: draft.initialBalance,
    currency: draft.currency,
    openingDate: draft.openingDate,
  };

  if (draft.kind === 'credit_card') {
    if (draft.creditLimit !== null) {
      body.creditLimit = draft.creditLimit;
    }
    if (draft.statementDay !== null) {
      body.statementDay = draft.statementDay;
    }
    if (draft.paymentDay !== null) {
      body.paymentDay = draft.paymentDay;
    }
  }

  return body;
}

function toMonth(dto: StatementMonthDto | null | undefined): CardMonth | null {
  return dto ? { year: dto.year, month: dto.month } : null;
}

function toStatement(dto: StatementDto): CardStatement {
  if (!isStatementStatus(dto.status)) {
    throw new UnknownCurrencyError(String(dto.status));
  }

  return {
    accountId: dto.accountId,
    month: { year: dto.year, month: dto.month },
    statementDay: dto.statementDay,
    periodStart: toDay(dto.periodStart),
    periodEnd: toDay(dto.periodEnd),
    paymentDueDate: toDay(dto.paymentDueDate),
    total: dto.total,
    paymentsTotal: dto.paymentsTotal,
    balanceDue: dto.balanceDue,
    status: dto.status,
    openingDebt: dto.openingDebt ?? 0,
    items: (dto.items ?? []).map((item) => ({
      transactionId: item.transactionId,
      description: item.description ?? null,
      categoryName: item.categoryName ?? null,
      purchaseDate: toDay(item.purchaseDate),
      number: item.number,
      installments: item.installments,
      principal: item.principal,
      interest: item.interest,
      amount: item.amount,
    })),
    payments: (dto.payments ?? []).map((payment) => ({
      transactionId: payment.transactionId,
      date: payment.date,
      fromAccountId: payment.fromAccountId,
      fromAccountName: payment.fromAccountName,
      paymentAmount: payment.paymentAmount,
      appliedAmount: payment.appliedAmount,
    })),
    previous: toMonth(dto.previous),
    next: toMonth(dto.next),
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

  statement(id: number, month?: CardMonth): Observable<CardStatement> {
    const params = month ? new HttpParams().set('year', month.year).set('month', month.month) : undefined;

    return this.http
      .get<ApiResponse<StatementDto>>(`${this.baseUrl}/${id}/statement`, { params })
      .pipe(unwrap(), map(toStatement), this.toErrors());
  }

  private toErrors<T>(): OperatorFunction<T, T> {
    return pipe(catchError((error: unknown) => throwError(() => toAccountError(error, this.transloco))));
  }
}
