/** Meta mínima y máxima del colchón, en meses de gasto. Coinciden con las del backend. */
export const CUSHION_GOAL_MIN = 1;
export const CUSHION_GOAL_MAX = 24;
export const CUSHION_GOAL_DEFAULT = 6;

/** Por qué no se pueden calcular los meses que cubre el ahorro. */
export type CushionReason = 'noPreviousMonths' | 'noSpending';

/** Cuenta que compone el ahorro del colchón. */
export interface CushionAccount {
  id: number;
  name: string;
  balance: number;
}

/** El colchón en una moneda. Las monedas no se suman ni se convierten. */
export interface CushionCurrency {
  currency: string;
  /** Saldo actual de las cuentas colchón de la moneda. */
  savings: number;
  /** Gasto mensual promedio de los meses completos anteriores. */
  averageMonthlySpent: number;
  /** Cuántos meses entraron en el promedio (0 a 5). */
  monthsUsed: number;
  /** Meses de gasto que cubre el ahorro; `null` cuando no se pueden calcular. */
  monthsCovered: number | null;
  reason: CushionReason | null;
  /** Meta en dinero: meses de la meta por el promedio; `null` sin promedio. */
  goalAmount: number | null;
  /** Lo que falta para la meta, nunca negativo; `null` sin promedio. */
  missing: number | null;
  accounts: CushionAccount[];
}

/** Bloque «Tu colchón» del Resumen. */
export interface Cushion {
  goalMonths: number;
  /** Si el usuario ya marcó cuentas: distingue «sin configurar» de «configurado con saldo 0». */
  hasCushionAccounts: boolean;
  /** Una fila por moneda, pesos primero. */
  currencies: CushionCurrency[];
}

/** Cuenta que se puede elegir para el colchón: activa y que no es tarjeta de crédito. */
export interface CushionCandidate {
  id: number;
  name: string;
  currency: string;
  balance: number;
  isCushion: boolean;
}

/** Cómo se pinta una moneda del colchón. */
export type CushionState = 'normal' | 'zero' | 'goalReached' | CushionReason;

/** El estado de una moneda según el contrato del backend. */
export function cushionState(row: CushionCurrency): CushionState {
  if (row.monthsCovered === null) {
    return row.reason ?? 'noSpending';
  }

  if (row.missing === 0) {
    return 'goalReached';
  }

  return row.savings <= 0 ? 'zero' : 'normal';
}

/** Lo que el ahorro supera a la meta; 0 si no la alcanza o no hay meta en dinero. */
export function cushionSurplus(row: Pick<CushionCurrency, 'savings' | 'goalAmount'>): number {
  return row.goalAmount === null ? 0 : Math.max(0, row.savings - row.goalAmount);
}

/** Pesos primero y luego el resto en orden alfabético. */
export function sortCurrencies<T extends { currency: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    a.currency === b.currency ? 0 : a.currency === 'COP' ? -1 : b.currency === 'COP' ? 1 : a.currency.localeCompare(b.currency),
  );
}

/** Ajusta una meta al rango permitido. */
export function clampGoal(months: number): number {
  return Math.min(CUSHION_GOAL_MAX, Math.max(CUSHION_GOAL_MIN, Math.round(months)));
}

/** Resumen en vivo de una moneda mientras se eligen cuentas en la hoja. */
export interface CushionPreview {
  currency: string;
  savings: number;
  /** `null` si la moneda no tiene gasto promedio con qué comparar. */
  monthsCovered: number | null;
  goalAmount: number | null;
  missing: number | null;
}

/**
 * Suma por moneda lo ahorrado en las cuentas elegidas y lo compara con el gasto promedio de esa moneda.
 * Un saldo negativo cuenta como 0, igual que en el backend.
 */
export function previewSelection(
  candidates: readonly CushionCandidate[],
  selected: ReadonlySet<number>,
  averages: Readonly<Record<string, number>>,
  goal: number,
): CushionPreview[] {
  const sums = new Map<string, number>();

  for (const candidate of candidates) {
    if (selected.has(candidate.id)) {
      sums.set(candidate.currency, (sums.get(candidate.currency) ?? 0) + candidate.balance);
    }
  }

  return sortCurrencies([...sums].map(([currency, savings]) => ({ currency, savings }))).map(({ currency, savings }) => {
    const average = averages[currency] ?? 0;

    if (average <= 0) {
      return { currency, savings, monthsCovered: null, goalAmount: null, missing: null };
    }

    const usable = Math.max(0, savings);
    const goalAmount = average * goal;

    return { currency, savings, monthsCovered: usable / average, goalAmount, missing: Math.max(0, goalAmount - usable) };
  });
}
