/** Ingreso y gasto de un mes del historial. */
export interface MonthFlow {
  year: number;
  /** Mes de 1 a 12. */
  month: number;
  income: number;
  spent: number;
}

/** Tipo de categoría que suma al gasto del mes. */
export type SpendingCategoryType = 'expense' | 'transfer';

/** Lo gastado en una categoría durante el mes. */
export interface CategorySpent {
  categoryId: number;
  name: string;
  type: SpendingCategoryType;
  spent: number;
}

/** Cifras de un mes en una moneda, como las calcula el backend para el Resumen. */
export interface CurrencyMonth {
  /** Código ISO de la moneda de las cuentas, por ejemplo `COP`. */
  currency: string;
  /** Ingreso recibido en el mes. */
  income: number;
  /** Cuántos movimientos de ingreso componen ese ingreso. */
  incomePayments: number;
  /** Gastado en el mes, con el mismo criterio que el Presupuesto. */
  spent: number;
  /** Lo que aún falta gastar de los topes del Presupuesto del mes. */
  committed: number;
  /** Hasta 6 meses, incluido el pedido, del más antiguo al más reciente. */
  history: MonthFlow[];
  /** Gasto por categoría del mes, de mayor a menor. */
  categories: CategorySpent[];
}

/** Resumen del mes: una entrada por moneda con movimientos o topes. */
export interface MonthSummary {
  year: number;
  month: number;
  currencies: CurrencyMonth[];
}

/** Año y mes, con el mes de 1 a 12. */
export interface SummaryMonth {
  year: number;
  month: number;
}

/** Desfase de la hora de Colombia (UTC−5, sin horario de verano), en milisegundos. */
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** Fecha ISO (`yyyy-mm-dd`) de hoy en la hora de Colombia, que es la que usa el backend para el mes. */
export function todayInDashboardZone(now: Date = new Date()): string {
  return new Date(now.getTime() + COLOMBIA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Año y mes de una fecha ISO. */
export function monthOfDay(date: string): SummaryMonth {
  const [year, month] = date.split('-').map(Number);

  return { year, month };
}

/** Clave `yyyy-MM` de un mes, la forma que usa `monthOutlook`. */
export function monthKey({ year, month }: SummaryMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
