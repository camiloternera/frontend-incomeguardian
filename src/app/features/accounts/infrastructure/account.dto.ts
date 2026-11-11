/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */
export interface AccountDto {
  id: number;
  name: string;
  /** "standard" o "credit_card"; opcional mientras el backend desplegado no lo envíe. */
  kind?: string | null;
  initialBalance: number;
  currentBalance: number | null;
  currency: string;
  isActive: boolean;
  hasTransactions?: boolean | null;
  /** Fecha y hora de apertura, en UTC. */
  openingDate: string;
  creditLimit?: number | null;
  statementDay?: number | null;
  paymentDay?: number | null;
  availableCredit?: number | null;
  /** `yyyy-MM-dd`; null en una cuenta normal. */
  nextStatementDate?: string | null;
  nextPaymentDueDate?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountRequestDto {
  name: string;
  kind: string;
  /** En una tarjeta, la deuda en negativo. */
  initialBalance: number;
  currency: string;
  openingDate: string;
  creditLimit?: number;
  statementDay?: number;
  paymentDay?: number;
}

/** Un mes de `GET /accounts/{id}/statement`. */
export interface StatementMonthDto {
  year: number;
  month: number;
}

export interface StatementItemDto {
  transactionId: number;
  description: string | null;
  categoryName: string | null;
  purchaseDate: string;
  number: number;
  installments: number;
  principal: number;
  interest: number;
  amount: number;
}

export interface StatementPaymentDto {
  transactionId: number;
  /** UTC. */
  date: string;
  fromAccountId: number;
  fromAccountName: string;
  paymentAmount: number;
  appliedAmount: number;
}

/** Respuesta de `GET /api/v1/accounts/{id}/statement`. */
export interface StatementDto {
  accountId: number;
  year: number;
  month: number;
  statementDay: number;
  periodStart: string;
  periodEnd: string;
  paymentDueDate: string;
  total: number;
  paymentsTotal: number;
  balanceDue: number;
  status: string;
  openingDebt?: number | null;
  items: StatementItemDto[];
  payments?: StatementPaymentDto[] | null;
  previous?: StatementMonthDto | null;
  next?: StatementMonthDto | null;
}
