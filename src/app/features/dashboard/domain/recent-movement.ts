import { todayInDashboardZone } from './month-summary';

/** Cuántos movimientos muestra «Movimientos recientes» del Resumen. */
export const RECENT_MOVEMENTS_LIMIT = 6;

/** Clases de movimiento que muestra el Resumen. */
export const RECENT_MOVEMENT_KINDS = ['income', 'expense', 'transfer'] as const;
export type RecentMovementKind = (typeof RECENT_MOVEMENT_KINDS)[number];

/** Indica si el valor recibido es una clase de movimiento conocida. */
export function isRecentMovementKind(value: unknown): value is RecentMovementKind {
  return typeof value === 'string' && (RECENT_MOVEMENT_KINDS as readonly string[]).includes(value);
}

/** Monto que llegó a la cuenta destino de una transferencia entre monedas distintas. */
export interface RecentMovementDestination {
  amount: number;
  currency: string;
}

/** Un movimiento reciente con los nombres ya resueltos por el backend. */
export interface RecentMovement {
  id: number;
  kind: RecentMovementKind;
  /** Instante ISO 8601 en UTC. */
  date: string;
  /** Día `yyyy-mm-dd` en la hora de Colombia; agrupa la lista. */
  day: string;
  description: string | null;
  /** Monto en la moneda de la cuenta origen (o de la destino en un ingreso). */
  amount: number;
  currency: string;
  categoryName: string | null;
  isCardPayment: boolean;
  /** Transferencia de una tarjeta a una cuenta normal. */
  isCardAdvance: boolean;
  /** Gasto con la comisión del banco por un avance. */
  isAdvanceFee: boolean;
  /** Cuotas de una compra con tarjeta; 1 en cualquier otro movimiento. */
  installments: number;
  fromAccountName: string | null;
  toAccountName: string | null;
  /** Solo en una transferencia entre monedas distintas; `null` en los demás casos. */
  destination: RecentMovementDestination | null;
}

/** Día `yyyy-mm-dd` en la hora de Colombia de un instante ISO. */
export function dayInDashboardZone(instant: string): string {
  return todayInDashboardZone(new Date(instant));
}
