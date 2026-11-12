import { Observable, of, throwError } from 'rxjs';
import { RecentMovement } from '../domain/recent-movement';
import { RecentMovementsRepository } from '../domain/recent-movements.repository';

/** Día `yyyy-mm-dd` que queda `offset` días antes de `day`. */
export function daysBefore(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, date - offset)).toISOString().slice(0, 10);
}

/** Un gasto de ejemplo en pesos el día dado, con cambios. */
export function recentMovement(day: string, changes: Partial<RecentMovement> = {}): RecentMovement {
  return {
    id: 1,
    kind: 'expense',
    // 10:00 en Colombia: el mismo día en UTC y en hora local.
    date: `${day}T15:00:00Z`,
    day,
    description: null,
    amount: 100_000,
    currency: 'COP',
    categoryName: 'Comida',
    isCardPayment: false,
    installments: 1,
    fromAccountName: 'Nequi',
    toAccountName: null,
    destination: null,
    ...changes,
  };
}

/** Cinco movimientos en tres días que terminan en `today`, del más reciente al más antiguo. */
export function sampleRecentMovements(today: string): RecentMovement[] {
  const yesterday = daysBefore(today, 1);
  const earlier = daysBefore(today, 3);

  return [
    recentMovement(today, {
      id: 1,
      kind: 'income',
      description: 'Pago Estudio Norte',
      amount: 3_200_000,
      categoryName: 'Freelance',
      fromAccountName: null,
      toAccountName: 'Bancolombia ahorros',
    }),
    recentMovement(today, { id: 2, description: 'Mercado Éxito', amount: 186_400, categoryName: 'Comida', fromAccountName: 'Tarjeta Visa' }),
    recentMovement(yesterday, { id: 3, description: 'Netflix', amount: 44_900, categoryName: 'Suscripciones', fromAccountName: 'Tarjeta Visa' }),
    recentMovement(yesterday, { id: 4, description: 'Uber', amount: 23_500, categoryName: 'Transporte', fromAccountName: 'Nequi' }),
    recentMovement(earlier, {
      id: 5,
      kind: 'transfer',
      description: null,
      amount: 500_000,
      categoryName: null,
      fromAccountName: 'Bancolombia ahorros',
      toAccountName: 'Nequi',
    }),
  ];
}

/** Repositorio en memoria para los specs: guarda los límites pedidos y puede fallar a demanda. */
export class FakeRecentMovementsRepository extends RecentMovementsRepository {
  /** Respuesta; si es `null`, devuelve `sampleRecentMovements` del día dado al construirlo. */
  movements: RecentMovement[] | null = null;
  readonly requested: number[] = [];
  failWith: Error | null = null;

  constructor(private readonly today: string) {
    super();
  }

  recent(limit: number): Observable<RecentMovement[]> {
    this.requested.push(limit);

    if (this.failWith) {
      const error = this.failWith;
      this.failWith = null;

      return throwError(() => error);
    }

    return of(this.movements ?? sampleRecentMovements(this.today));
  }
}
