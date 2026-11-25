/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */
export interface AccountDto {
  id: number;
  name: string;
  /** "standard" o "credit_card"; opcional mientras el backend desplegado no lo envíe. */
  kind?: string | null;
  /** Id del tipo en el catálogo (`GET /api/v1/account-kinds`). */
  accountKindId?: number | null;
  initialBalance: number;
  currentBalance: number | null;
  /** Código ISO 4217. */
  currency: string;
  /** Id de la moneda en el catálogo. */
  currencyId: number;
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
  /** Opcional mientras el backend desplegado no lo envíe. */
  isCushion?: boolean | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountRequestDto {
  name: string;
  /** Id de un tipo activo del catálogo; sin él el backend crea una cuenta normal. */
  accountKindId: number;
  /** En una tarjeta, la deuda en negativo. */
  initialBalance: number;
  /** Id de una moneda activa del catálogo (`GET /api/v1/currencies`). */
  currencyId: number;
  openingDate: string;
  creditLimit?: number;
  statementDay?: number;
  paymentDay?: number;
  isCushion: boolean;
}

/** Un tipo de `GET /api/v1/account-kinds`. */
export interface AccountKindDto {
  id: number;
  code: string;
  name: string;
}

/** Un mes de `GET /accounts/{id}/statement`. */
export interface StatementMonthDto {
  year: number;
  month: number;
}

export interface StatementItemDto {
  transactionId: number;
  /** `purchase`, `advance` o `fee`; opcional mientras el backend desplegado no lo envíe. */
  kind?: string | null;
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
