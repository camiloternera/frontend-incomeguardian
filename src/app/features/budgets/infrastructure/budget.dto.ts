/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */

/** Una fila de `GET /api/v1/budgets/summary`. */
export interface BudgetRowDto {
  categoryId: number;
  categoryName: string;
  /** 2 Gasto, 3 Transferencia. */
  categoryTypeId: number;
  currency: string;
  budgetAmount: number;
  spentAmount: number;
  availableAmount: number;
  percentUsed: number | null;
  recurringAmount: number | null;
  source: string;
  /** Campos de tarjetas: opcionales mientras el backend desplegado no los envíe. */
  monthAmount?: number | null;
  installmentsRaise?: number | null;
  installmentsSpent?: number | null;
  installments?: BudgetInstallmentDto[] | null;
}

export interface BudgetInstallmentDto {
  transactionId: number;
  description: string | null;
  number: number;
  installments: number;
  accountId: number;
  accountName: string;
  purchaseDate: string;
  amount: number;
  budgetAdjustment: number;
}

export interface BudgetTotalDto {
  currency: string;
  budget: number;
  spent: number;
  available: number;
  installmentsSpent?: number | null;
}

/** Respuesta de `GET /api/v1/budgets/summary?year=&month=`. */
export interface BudgetSummaryDto {
  year: number;
  month: number;
  isClosed: boolean;
  rows: BudgetRowDto[];
  totals: BudgetTotalDto[];
}

/** Cuerpo de `PUT /api/v1/budgets/recurring`. */
export interface RecurringBudgetRequestDto {
  categoryId: number;
  currency: string;
  amount: number;
  fromYear: number;
  fromMonth: number;
}

/** Cuerpo de `PUT /api/v1/budgets/{year}/{month}`. */
export interface MonthBudgetRequestDto {
  categoryId: number;
  currency: string;
  amount: number;
}

/** Lo que este dominio lee de `GET /api/v1/categories`; ignora el resto de campos. */
export interface BudgetCategoryOptionDto {
  id: number;
  name: string;
  isActive: boolean;
  /** 1 Ingreso, 2 Gasto, 3 Transferencia. */
  transactionTypeId: number;
}

/** Lo que este dominio lee de `GET /api/v1/accounts`; ignora el resto de campos. */
export interface BudgetAccountDto {
  id: number;
  name: string;
  currency: string;
  kind?: string | null;
}

/** Lo que este dominio lee de un movimiento de `GET /api/v1/transactions`. */
export interface BudgetTransactionDto {
  id: number;
  amount: number;
  date: string;
  fromAccountId: number | null;
  description: string | null;
}

export interface BudgetTransactionPageDto {
  items: BudgetTransactionDto[];
}
