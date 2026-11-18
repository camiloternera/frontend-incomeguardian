import { Observable, of, throwError } from 'rxjs';
import { Cushion, CushionCandidate, CushionCurrency } from '../domain/cushion';
import { CushionRepository } from '../domain/cushion.repository';

/** Pesos de ejemplo: 9.360.000 ahorrados contra un promedio de 3.900.000, 2,4 de 6 meses. */
export function cushionCurrency(changes: Partial<CushionCurrency> = {}): CushionCurrency {
  return {
    currency: 'COP',
    savings: 9_360_000,
    averageMonthlySpent: 3_900_000,
    monthsUsed: 5,
    monthsCovered: 2.4,
    reason: null,
    goalAmount: 23_400_000,
    missing: 14_040_000,
    accounts: [
      { id: 1, name: 'Davivienda ahorros', balance: 6_000_000 },
      { id: 2, name: 'Bolsillo Nu', balance: 3_360_000 },
    ],
    ...changes,
  };
}

/** Colchón configurado con una moneda, con cambios. */
export function sampleCushion(changes: Partial<Cushion> = {}): Cushion {
  return { goalMonths: 6, hasCushionAccounts: true, currencies: [cushionCurrency()], ...changes };
}

/** Cuentas que ofrece la hoja: dos marcadas en pesos y una en dólares sin marcar. */
export function sampleCandidates(): CushionCandidate[] {
  return [
    { id: 1, name: 'Davivienda ahorros', currency: 'COP', balance: 6_000_000, isCushion: true },
    { id: 2, name: 'Bolsillo Nu', currency: 'COP', balance: 3_360_000, isCushion: true },
    { id: 3, name: 'Cuenta USD', currency: 'USD', balance: 1_200, isCushion: false },
  ];
}

/** Repositorio del colchón en memoria que recuerda lo guardado y puede fallar a pedido. */
export class FakeCushionRepository extends CushionRepository {
  current: Cushion = sampleCushion();
  candidateList: CushionCandidate[] = sampleCandidates();
  savedAccounts: number[][] = [];
  savedGoals: number[] = [];
  cushionCalls = 0;
  /** Si se define, la operación correspondiente falla con este error. */
  cushionError: unknown = null;
  saveAccountsError: unknown = null;
  saveGoalError: unknown = null;
  /** Reemplaza la respuesta del colchón, por ejemplo para dejarlo cargando. */
  cushionSource: Observable<Cushion> | null = null;

  cushion(): Observable<Cushion> {
    this.cushionCalls++;

    if (this.cushionSource) {
      return this.cushionSource;
    }

    return this.cushionError ? throwError(() => this.cushionError) : of(this.current);
  }

  candidates(): Observable<CushionCandidate[]> {
    return of(this.candidateList);
  }

  saveAccounts(accountIds: readonly number[]): Observable<void> {
    if (this.saveAccountsError) {
      return throwError(() => this.saveAccountsError);
    }

    this.savedAccounts.push([...accountIds]);
    return of(undefined);
  }

  saveGoal(months: number): Observable<void> {
    if (this.saveGoalError) {
      return throwError(() => this.saveGoalError);
    }

    this.savedGoals.push(months);
    return of(undefined);
  }
}
