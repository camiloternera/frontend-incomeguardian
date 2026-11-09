import { DashboardOverview, MovementSummary } from './dashboard-overview';

/** Cómo va el mes: cuánto queda para gastar y cómo se reparte el ingreso. */
export interface MonthOutlook {
  /** Ingreso menos lo gastado y lo comprometido; negativo si el mes se pasó. */
  available: number;
  /** Si lo gastado y lo comprometido superan el ingreso. */
  overspent: boolean;
  /** Partes del ingreso, de 0 a 1; suman 1 cuando hay ingreso. */
  spentShare: number;
  committedShare: number;
  availableShare: number;
  /** Días que quedan después de `asOf` hasta el cierre del mes. */
  daysLeft: number;
  /** Último día del mes, fecha ISO. */
  monthEnd: string;
  /** Disponible repartido entre los días que quedan; `null` si no hay nada que repartir. */
  perDay: number | null;
}

/** Promedios mensuales de los meses anteriores al del resumen. */
export interface PreviousAverages {
  months: number;
  income: number;
  expenses: number;
}

/** Movimientos de un mismo día. */
export interface MovementDay {
  /** Fecha ISO del día. */
  date: string;
  /** `today` o `yesterday` respecto a `asOf`; `null` para días anteriores. */
  relative: 'today' | 'yesterday' | null;
  movements: MovementSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha ISO (`yyyy-mm-dd`) a milisegundos UTC, sin depender de la zona horaria. */
function toUtc(date: string): number {
  const [year, month, day] = date.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
}

function share(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

/** Cifras del mes que bastan para calcular lo disponible. */
export type MonthFigures = Pick<DashboardOverview, 'month' | 'asOf' | 'income' | 'expenses' | 'committed'>;

/** Calcula lo disponible del mes, su reparto y cuánto toca por día. */
export function monthOutlook(overview: MonthFigures): MonthOutlook {
  const { income, expenses, committed } = overview;
  const available = income - expenses - committed;
  const overspent = available < 0;

  // Si el mes se pasó, la barra se reparte entre lo usado para no salirse del 100 %.
  const used = expenses + committed;
  const base = overspent ? used : income;

  const [year, month] = overview.month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${overview.month}-${String(lastDay).padStart(2, '0')}`;
  const daysLeft = Math.max(0, Math.round((toUtc(monthEnd) - toUtc(overview.asOf)) / DAY_MS));

  return {
    available,
    overspent,
    spentShare: share(expenses, base),
    committedShare: share(committed, base),
    availableShare: overspent ? 0 : share(available, base),
    daysLeft,
    monthEnd,
    perDay: available > 0 && daysLeft > 0 ? available / daysLeft : null,
  };
}

/** Promedia ingresos y gastos de los meses previos al del resumen; `null` si no hay ninguno. */
export function previousAverages(overview: DashboardOverview): PreviousAverages | null {
  const previous = overview.cashFlow.filter((point) => point.month < overview.month);

  if (previous.length === 0) {
    return null;
  }

  const total = previous.reduce(
    (sum, point) => ({ income: sum.income + point.income, expenses: sum.expenses + point.expenses }),
    { income: 0, expenses: 0 },
  );

  return {
    months: previous.length,
    income: total.income / previous.length,
    expenses: total.expenses / previous.length,
  };
}

/** Meses de gasto promedio que cubren los ahorros; `null` sin gasto promedio. */
export function cushionMonths(savings: number, averageExpenses: number): number | null {
  return averageExpenses > 0 ? savings / averageExpenses : null;
}

/** Parte del ingreso que queda tras lo gastado y lo comprometido; `null` sin ingreso. */
export function projectedSavingsRate(overview: DashboardOverview): number | null {
  if (overview.income <= 0) {
    return null;
  }

  return (overview.income - overview.expenses - overview.committed) / overview.income;
}

/** Agrupa los movimientos por día, del más reciente al más antiguo, conservando su orden dentro del día. */
export function groupByDay(movements: MovementSummary[], asOf: string): MovementDay[] {
  const days = new Map<string, MovementSummary[]>();

  for (const movement of movements) {
    days.set(movement.date, [...(days.get(movement.date) ?? []), movement]);
  }

  const today = toUtc(asOf);

  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => {
      const difference = Math.round((today - toUtc(date)) / DAY_MS);
      const relative = difference === 0 ? 'today' : difference === 1 ? 'yesterday' : null;

      return { date, relative, movements: items };
    });
}
