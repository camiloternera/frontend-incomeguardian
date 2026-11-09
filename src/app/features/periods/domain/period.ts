/** Zona horaria en la que el backend decide cuándo termina un mes. */
export const PERIOD_TIME_ZONE = 'America/Bogota';

/** Longitud máxima del motivo de una reapertura. */
export const PERIOD_REASON_MAX_LENGTH = 200;

/** Días del mes siguiente en los que se puede cerrar solo un mes. */
export const AUTO_CLOSE_DAYS = [1, 5, 10] as const;

export type AutoCloseDay = (typeof AUTO_CLOSE_DAYS)[number];

/**
 * Estado de un mes.
 * - `closed`: cerrado, en solo lectura.
 * - `pending`: terminó y sigue abierto.
 * - `current`: mes en curso.
 * - `future`: aún no empieza.
 * - `noActivity`: anterior a la primera cuenta; no necesita cierre.
 */
export type PeriodMonthStatus = 'closed' | 'pending' | 'current' | 'future' | 'noActivity';

/** Cómo vuelve a cerrarse un mes reabierto: solo al día siguiente o cuando el usuario lo cierre. */
export type RecloseMode = 'auto' | 'manual';

export interface PeriodMonth {
  /** Mes de 1 a 12. */
  month: number;
  status: PeriodMonthStatus;
  /** Instante ISO del cierre; solo si está cerrado. */
  closedAt: string | null;
  closedAutomatically: boolean;
  /** Instante ISO de la última reapertura, si sigue abierto tras reabrirse. */
  reopenedAt: string | null;
  recloseMode: RecloseMode | null;
  /** Instante ISO en que vuelve a cerrarse solo, si se reabrió en modo automático. */
  recloseAt: string | null;
  /** Día (`yyyy-MM-dd`) en que se cerrará solo, si aplica. */
  autoCloseOn: string | null;
  canClose: boolean;
  canReopen: boolean;
}

export interface PeriodYear {
  year: number;
  yearClosed: boolean;
  yearClosedAt: string | null;
  yearClosedAutomatically: boolean;
  canCloseYear: boolean;
  canReopenYear: boolean;
  /** Primer mes con cuentas (`yyyy-MM`), o null si aún no hay cuentas. */
  firstActivity: string | null;
  /** Los 12 meses, de enero a diciembre. */
  months: PeriodMonth[];
}

/** Totales del período en una moneda; COP y USD no se mezclan. */
export interface PeriodTotals {
  currency: string;
  income: number;
  expense: number;
  savings: number;
  /** Porcentaje de ahorro (0 a 100, con un decimal); null si no hubo ingresos. */
  savingsRate: number | null;
}

/** Saldo de una cuenta al último instante del período. */
export interface PeriodAccountBalance {
  accountId: number;
  name: string;
  currency: string;
  balance: number;
  isActive: boolean;
}

/** Lo que se revisa antes de cerrar un mes o un año. */
export interface PeriodReview {
  year: number;
  /** Mes revisado, o null cuando se revisa el año completo. */
  month: number | null;
  /** Estado del mes revisado; null en la revisión del año. */
  monthState: PeriodMonth | null;
  /** Estado del año; solo en la revisión del año. */
  yearState: PeriodYear | null;
  totals: PeriodTotals[];
  balances: PeriodAccountBalance[];
  /** Ingresos y gastos sin categoría en el período. */
  uncategorizedCount: number;
}

/** Mes que terminó sin cerrarse y que el Resumen recuerda. */
export interface PendingPeriod {
  year: number;
  month: number;
  /** Último día del mes (`yyyy-MM-dd`). */
  endedOn: string;
  autoCloseOn: string | null;
  canClose: boolean;
}

/** Un cierre o una reapertura registrados en el historial. */
export interface PeriodLog {
  year: number;
  /** Mes de 1 a 12, o null cuando el evento es del año completo. */
  month: number | null;
  action: 'close' | 'reopen';
  automatic: boolean;
  reason: string | null;
  createdAt: string;
}

export interface PeriodClosingSettings {
  autoCloseEnabled: boolean;
  autoCloseDay: number;
  closeYearWithDecember: boolean;
  remindOnMonthEnd: boolean;
}

/** Período al que apunta una acción: un mes, o el año completo cuando `month` es null. */
export interface PeriodRef {
  year: number;
  month: number | null;
}

export interface ReopenRequest {
  /** Solo aplica a meses; el año se reabre sin re-cierre. */
  recloseMode?: RecloseMode;
  reason: string | null;
}

/** Hoy en hora de Colombia, como `yyyy-MM-dd`. */
export function todayInPeriodZone(now: Date = new Date()): string {
  // `en-CA` formatea las fechas como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', { timeZone: PERIOD_TIME_ZONE }).format(now);
}

/** Año y mes (1 a 12) de una fecha `yyyy-MM-dd`; null si no tiene ese formato. */
export function yearMonthOf(date: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})/.exec(date);

  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

/** Días completos entre dos fechas `yyyy-MM-dd`. */
export function daysBetween(from: string, to: string): number {
  const start = Date.UTC(...splitDate(from));
  const end = Date.UTC(...splitDate(to));

  return Math.round((end - start) / 86_400_000);
}

function splitDate(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number);

  return [year, month - 1, day];
}

/** Último día (`yyyy-MM-dd`) de un mes. */
export function lastDayOf(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Meses del año que siguen abiertos y requieren cierre. */
export function openMonths(year: PeriodYear): PeriodMonth[] {
  return year.months.filter((month) => month.status === 'pending' || month.status === 'current');
}

/** Si una fecha cae en un mes cerrado según el estado del año. */
export function isClosedDate(year: PeriodYear, date: string): boolean {
  const target = yearMonthOf(date);

  if (!target || target.year !== year.year) {
    return false;
  }

  return year.months[target.month - 1]?.status === 'closed';
}

/** Mes que conviene mostrar al abrir un año: el pendiente más antiguo, el actual o diciembre. */
export function defaultMonthOf(year: PeriodYear, today: string): number {
  const pending = year.months.find((month) => month.status === 'pending');
  const current = yearMonthOf(today);

  if (pending) {
    return pending.month;
  }

  return current && current.year === year.year ? current.month : 12;
}
