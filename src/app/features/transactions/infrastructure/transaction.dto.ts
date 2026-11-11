/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */
export interface TransactionDto {
  id: number;
  type: string;
  amount: number;
  date: string;
  fromAccountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  description: string | null;
  /** Campos de multimoneda: opcionales mientras el backend desplegado no los envíe. */
  fromCurrency?: string | null;
  toCurrency?: string | null;
  destinationAmount?: number | null;
  exchangeRate?: number | null;
  exchangeRateDate?: string | null;
  /** Campos de cuotas: opcionales mientras el backend desplegado no los envíe. */
  installments?: number | null;
  annualInterestRate?: number | null;
  installmentAmount?: number | null;
  schedule?: InstallmentScheduleItemDto[] | null;
}

export interface InstallmentScheduleItemDto {
  number: number;
  year: number;
  month: number;
  statementDate: string;
  principal: number;
  interest: number;
  amount: number;
}

/** Cuerpo de `POST /api/v1/transactions/installments/preview`. */
export interface InstallmentPreviewRequestDto {
  fromAccountId: number;
  amount: number;
  date: string;
  installments: number;
  annualInterestRate?: number;
  categoryId?: number;
}

export interface BudgetAdjustmentDto {
  year: number;
  month: number;
  categoryId: number;
  currency: string;
  currentAmount?: number | null;
  newAmount: number;
}

/** Respuesta de `POST /api/v1/transactions/installments/preview`. */
export interface InstallmentPreviewDto {
  installmentAmount: number;
  totalInterest: number;
  totalAmount: number;
  schedule: InstallmentScheduleItemDto[];
  budgetAdjustments?: BudgetAdjustmentDto[] | null;
}

export interface TransactionPageDto {
  items: TransactionDto[];
  page: number;
  pageSize: number;
  totalItems: number;
}

/** Una moneda de `GET /api/v1/transactions/summary`. */
export interface TransactionCurrencySummaryDto {
  currency: string;
  income: number;
  expense: number;
  transfersIn: number;
  transfersOut: number;
  net: number;
}

/** Respuesta de `GET /api/v1/transactions/summary`. */
export interface TransactionSummaryDto {
  totalItems: number;
  currencies: TransactionCurrencySummaryDto[];
}

/** Cuerpo de `POST /api/v1/transactions`: los campos ausentes no se envían. */
export interface TransactionRequestDto {
  type: string;
  amount: number;
  date: string;
  fromAccountId?: number;
  toAccountId?: number;
  categoryId?: number;
  description?: string;
  /** Solo en gastos con tarjeta a más de una cuota. */
  installments?: number;
  annualInterestRate?: number;
}

/** Lo que este dominio lee de `GET /api/v1/accounts`; ignora el resto de campos. */
export interface TransactionAccountOptionDto {
  id: number;
  name: string;
  currency: string;
  initialBalance: number;
  currentBalance: number | null;
  isActive: boolean;
  kind?: string | null;
  availableCredit?: number | null;
  nextStatementDate?: string | null;
}

/** Lo que este dominio lee de `GET /api/v1/categories`; ignora el resto de campos. */
export interface TransactionCategoryOptionDto {
  id: number;
  name: string;
  isActive: boolean;
  /** 1 Ingreso, 2 Gasto, 3 Transferencia. */
  transactionTypeId: number;
  /** Código de una categoría de sistema; null en las del usuario. */
  code?: string | null;
}

/** Respuesta de `GET /api/v1/exchange-rates/trm`. */
export interface ExchangeRateDto {
  base: string;
  quote: string;
  rate: number;
  validFrom: string;
  validTo: string;
  source: string;
}
