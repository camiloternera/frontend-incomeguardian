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
}

export interface TransactionPageDto {
  items: TransactionDto[];
  page: number;
  pageSize: number;
  totalItems: number;
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
}

/** Lo que este dominio lee de `GET /api/v1/accounts`; ignora el resto de campos. */
export interface TransactionAccountOptionDto {
  id: number;
  name: string;
  currency: string;
  initialBalance: number;
  currentBalance: number | null;
  isActive: boolean;
}

/** Lo que este dominio lee de `GET /api/v1/categories`; ignora el resto de campos. */
export interface TransactionCategoryOptionDto {
  id: number;
  name: string;
  isActive: boolean;
  /** 1 Ingreso, 2 Gasto, 3 Transferencia. */
  transactionTypeId: number;
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
