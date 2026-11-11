import { CardMonth } from './credit-card-calendar';

/**
 * Estado de un extracto: su ciclo aún no empieza (`upcoming`), está en curso y no corta (`open`),
 * cortó sin abonos (`due`), con abonos parciales (`partial`), pagado (`paid`, también un ciclo en curso
 * con cargos ya cubiertos) o vencido con saldo (`overdue`).
 */
export const STATEMENT_STATUSES = ['upcoming', 'open', 'due', 'partial', 'paid', 'overdue'] as const;
export type StatementStatus = (typeof STATEMENT_STATUSES)[number];

/** Indica si el valor recibido es un estado de extracto conocido. */
export function isStatementStatus(value: unknown): value is StatementStatus {
  return typeof value === 'string' && (STATEMENT_STATUSES as readonly string[]).includes(value);
}

/** Una cuota de una compra que cobra el extracto. Las compras de una sola cuota también aparecen. */
export interface StatementItem {
  transactionId: number;
  description: string | null;
  categoryName: string | null;
  /** Día de la compra, `YYYY-MM-DD`. */
  purchaseDate: string;
  /** Número de la cuota y total de cuotas de la compra. */
  number: number;
  installments: number;
  principal: number;
  interest: number;
  amount: number;
}

/** Un pago a la tarjeta abonado (del todo o en parte) a este extracto. */
export interface StatementPayment {
  transactionId: number;
  /** Instante ISO 8601 en UTC. */
  date: string;
  fromAccountId: number;
  fromAccountName: string;
  /** Monto completo del pago; puede abonarse a varios extractos. */
  paymentAmount: number;
  /** Parte del pago abonada a este extracto. */
  appliedAmount: number;
}

/** Extracto mensual de una tarjeta. */
export interface CardStatement {
  accountId: number;
  /** Mes de corte. */
  month: CardMonth;
  statementDay: number;
  /** Ciclo del extracto, ambos días incluidos (`YYYY-MM-DD`). */
  periodStart: string;
  periodEnd: string;
  paymentDueDate: string;
  /** openingDebt más la suma de las cuotas. */
  total: number;
  /** Lo abonado a este extracto. */
  paymentsTotal: number;
  /** Lo que falta por pagar, nunca negativo. */
  balanceDue: number;
  status: StatementStatus;
  /** "Saldo anterior": la deuda inicial, solo en el primer extracto tras la apertura; 0 en los demás. */
  openingDebt: number;
  items: StatementItem[];
  payments: StatementPayment[];
  /** Extractos vecinos; null si no hay más en esa dirección. */
  previous: CardMonth | null;
  next: CardMonth | null;
}

/**
 * Indica si al extracto todavía le falta un pago. Un extracto cuyo ciclo aún no empieza no se paga:
 * sus cuotas se cobran más adelante.
 */
export function canPayStatement(statement: Pick<CardStatement, 'balanceDue' | 'status'>): boolean {
  return statement.status !== 'upcoming' && statement.balanceDue > 0;
}
