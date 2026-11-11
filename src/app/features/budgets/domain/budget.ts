/** Monedas en las que se puede fijar un tope, en código ISO 4217. */
export const BUDGET_CURRENCIES = ['COP', 'USD'] as const;
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];

/** Indica si la moneda admite topes. */
export function isBudgetCurrency(value: unknown): value is BudgetCurrency {
  return typeof value === 'string' && (BUDGET_CURRENCIES as readonly string[]).includes(value);
}

/** Tipos de categoría que admiten tope: los ingresos no tienen. */
export const BUDGET_CATEGORY_TYPES = ['expense', 'transfer'] as const;
export type BudgetCategoryType = (typeof BUDGET_CATEGORY_TYPES)[number];

/** Límites del monto, iguales a los del backend (NUMERIC(18,3)). */
export const BUDGET_AMOUNT_MAX_DECIMALS = 2;
export const BUDGET_AMOUNT_MAX_INTEGER_DIGITS = 15;

/** Zona horaria en la que el backend decide qué mes está en curso. */
export const BUDGET_TIME_ZONE = 'America/Bogota';

/**
 * De dónde sale el tope de una categoría en un mes.
 * - `recurring`: el tope que se repite cada mes.
 * - `month`: un tope propio de ese mes (0 = pausado ese mes).
 * - `none`: sin tope; la fila aparece porque hubo gasto.
 */
export type BudgetSource = 'recurring' | 'month' | 'none';

/** Un mes del calendario; `month` va de 1 a 12. */
export interface BudgetMonth {
  year: number;
  month: number;
}

/** Una categoría en el resumen del mes, en una moneda. */
export interface BudgetRow {
  categoryId: number;
  categoryName: string;
  /** null si el backend envía un tipo que la app no conoce. */
  categoryType: BudgetCategoryType | null;
  currency: string;
  budgetAmount: number;
  spentAmount: number;
  /** Tope menos gastado; negativo si se pasó. */
  availableAmount: number;
  /** Porcentaje usado del tope; null si no hay tope. */
  percentUsed: number | null;
  /** Tope recurrente vigente en el mes, aunque el mes use uno propio. */
  recurringAmount: number | null;
  source: BudgetSource;
  /** Tope propio del mes; null si el mes usa el recurrente o no tiene tope. */
  monthAmount: number | null;
  /** Cuánto subieron el tope las cuotas de compras de meses anteriores; > 0 = «subido por cuotas». */
  installmentsRaise: number;
  /** Lo gastado en compras de más de una cuota. */
  installmentsSpent: number;
  /** Cuotas con tarjeta que cuentan este mes, incluidas las compras de una sola cuota. */
  installments: BudgetInstallment[];
}

/** Una cuota de una compra con tarjeta que cuenta en el mes. */
export interface BudgetInstallment {
  transactionId: number;
  description: string | null;
  /** Número de la cuota y total de cuotas de la compra. */
  number: number;
  installments: number;
  accountId: number;
  accountName: string;
  /** Día de la compra, `YYYY-MM-DD`. */
  purchaseDate: string;
  amount: number;
  /** Cuánto subió esta cuota el tope del mes; 0 si no lo subió (por ejemplo, en el mes de la compra). */
  budgetAdjustment: number;
}

/** Compras de más de una cuota que cuentan en el mes, para el chip «N cuotas». */
export function installmentPurchases(row: Pick<BudgetRow, 'installments'>): BudgetInstallment[] {
  return row.installments.filter((item) => item.installments > 1);
}

/** Un gasto de una cuenta normal que cuenta en el mes de una categoría. */
export interface BudgetMovement {
  transactionId: number;
  description: string | null;
  accountName: string;
  /** Instante ISO 8601 en UTC. */
  date: string;
  amount: number;
}

/** Totales del mes en una moneda; COP y USD nunca se mezclan. */
export interface BudgetTotal {
  currency: string;
  budget: number;
  spent: number;
  available: number;
  /** De lo gastado, lo que fue en compras de más de una cuota. */
  installmentsSpent: number;
}

export interface BudgetSummary {
  year: number;
  month: number;
  /** Un mes cerrado es de solo lectura. */
  isClosed: boolean;
  /** Ordenadas por moneda y luego por nombre de categoría. */
  rows: BudgetRow[];
  totals: BudgetTotal[];
}

/** Categoría del usuario: nombra el tipo, marca las desactivadas y se elige al crear un tope. */
export interface BudgetCategoryOption {
  id: number;
  name: string;
  /** null para ingresos y tipos desconocidos: no admiten tope. */
  type: BudgetCategoryType | null;
  isActive: boolean;
}

/** Alcance de un tope: desde un mes en adelante o solo para ese mes. */
export type BudgetScope = 'recurring' | 'month';

/** Identifica el tope de una categoría en una moneda. */
export interface BudgetKey {
  categoryId: number;
  currency: string;
}

/** Tope a guardar: categoría, moneda y monto, para un mes y su alcance. */
export interface BudgetDraft {
  categoryId: number;
  currency: BudgetCurrency;
  amount: number;
  month: BudgetMonth;
  scope: BudgetScope;
}

/**
 * Cómo va una categoría frente a su tope.
 * - `paused`: tope propio de 0 en el mes.
 * - `unbudgeted`: sin tope.
 * - `over`: gastó más que el tope.
 * - `full`: gastó exactamente el tope.
 * - `partial`: aún tiene disponible.
 */
export type BudgetUsage = 'paused' | 'unbudgeted' | 'over' | 'full' | 'partial';

export function usageOf(row: BudgetRow): BudgetUsage {
  if (row.source === 'month' && row.budgetAmount === 0) {
    return 'paused';
  }

  if (row.source === 'none' || row.budgetAmount <= 0) {
    return 'unbudgeted';
  }

  if (row.spentAmount > row.budgetAmount) {
    return 'over';
  }

  return row.spentAmount === row.budgetAmount ? 'full' : 'partial';
}

/** Porcentaje de la barra (0 a 100): llena si se pasó o si gastó sin tope. */
export function barPercent(row: BudgetRow): number {
  switch (usageOf(row)) {
    case 'paused':
      return 0;
    case 'unbudgeted':
      return row.spentAmount > 0 ? 100 : 0;
    default:
      return Math.min(100, (row.spentAmount / row.budgetAmount) * 100);
  }
}

/** Porcentaje usado del total de una moneda, redondeado; null si no hay tope. */
export function totalPercent(total: BudgetTotal): number | null {
  return total.budget > 0 ? Math.round((total.spent / total.budget) * 100) : null;
}

/** Una moneda del resumen: sus totales y sus filas. */
export interface BudgetCurrencyBlock {
  currency: string;
  total: BudgetTotal;
  rows: BudgetRow[];
}

/** Agrupa el resumen por moneda: pesos primero, luego dólares y las demás por código. */
export function blocksOf(summary: BudgetSummary): BudgetCurrencyBlock[] {
  const currencies = [
    ...new Set([...summary.totals.map((total) => total.currency), ...summary.rows.map((row) => row.currency)]),
  ];
  const rank = (currency: string) => {
    const index = (BUDGET_CURRENCIES as readonly string[]).indexOf(currency);
    return index === -1 ? BUDGET_CURRENCIES.length : index;
  };

  return currencies
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((currency) => ({
      currency,
      total: summary.totals.find((total) => total.currency === currency) ?? {
          currency,
          budget: 0,
          spent: 0,
          available: 0,
          installmentsSpent: 0,
        },
      rows: summary.rows.filter((row) => row.currency === currency),
    }));
}

/** Indica si la categoría ya tiene tope (recurrente o propio) en esa moneda este mes. */
export function hasBudget(summary: BudgetSummary, key: BudgetKey): boolean {
  return summary.rows.some(
    (row) => row.categoryId === key.categoryId && row.currency === key.currency && row.source !== 'none',
  );
}

/**
 * Meses hacia adelante que se pueden consultar, en solo lectura: alcanza para ver todas las cuotas de la
 * compra más larga que permite una tarjeta.
 */
export const BUDGET_FUTURE_MONTHS_MAX = 48;

/** Último mes que se puede consultar a partir del mes en curso. */
export function lastViewableMonth(current: BudgetMonth): BudgetMonth {
  return shiftMonth(current, BUDGET_FUTURE_MONTHS_MAX);
}

/** Mes desplazado `delta` meses (negativo hacia atrás). */
export function shiftMonth({ year, month }: BudgetMonth, delta: number): BudgetMonth {
  const index = year * 12 + (month - 1) + delta;

  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Compara dos meses: negativo si `a` es anterior, 0 si son el mismo. */
export function compareMonths(a: BudgetMonth, b: BudgetMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** Lee un mes con la forma `YYYY-MM`; null si no la tiene. */
export function parseMonth(value: string | null): BudgetMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  const month = match ? Number(match[2]) : 0;

  return match && month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

/** El mes como `YYYY-MM`. */
export function formatMonthKey({ year, month }: BudgetMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Hoy en hora de Colombia, como `YYYY-MM-DD`. */
export function todayInBudgetZone(now: Date = new Date()): string {
  // `en-CA` formatea las fechas como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUDGET_TIME_ZONE }).format(now);
}

/** Mes de un día `YYYY-MM-DD`. */
export function monthOfDay(day: string): BudgetMonth {
  const [year, month] = day.split('-').map(Number);

  return { year, month };
}

/** Días que faltan para terminar el mes de `day` (`YYYY-MM-DD`), sin contar ese día. */
export function daysLeftInMonth(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return last - date;
}
