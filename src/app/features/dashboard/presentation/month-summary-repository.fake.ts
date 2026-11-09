import { Observable, of, throwError } from 'rxjs';
import { MonthFlow, MonthSummary, SummaryMonth } from '../domain/month-summary';
import { MonthSummaryRepository } from '../domain/month-summary.repository';

/** Los 6 meses que terminan en `last`, del más antiguo al más reciente, con sus cifras. */
function historyEndingIn(last: SummaryMonth, figures: [number, number][]): MonthFlow[] {
  return figures.map(([income, spent], index) => {
    const offset = index - (figures.length - 1);
    const date = new Date(Date.UTC(last.year, last.month - 1 + offset, 1));

    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, income, spent };
  });
}

/** Cifras de ejemplo en pesos y dólares, iguales a las del diseño del Resumen. */
export function sampleMonthSummary(month: SummaryMonth): MonthSummary {
  return {
    year: month.year,
    month: month.month,
    currencies: [
      {
        currency: 'COP',
        income: 6_200_000,
        incomePayments: 3,
        spent: 2_360_000,
        committed: 1_000_000,
        history: historyEndingIn(month, [
          [4_100_000, 3_700_000],
          [6_800_000, 4_200_000],
          [3_200_000, 3_900_000],
          [5_900_000, 3_600_000],
          [6_200_000, 4_000_000],
          [6_200_000, 2_360_000],
        ]),
        categories: [
          { categoryId: 1, name: 'Vivienda', type: 'expense', spent: 1_150_000 },
          { categoryId: 2, name: 'Comida y mercado', type: 'expense', spent: 520_000 },
          { categoryId: 3, name: 'Transporte', type: 'expense', spent: 240_000 },
          { categoryId: 4, name: 'Suscripciones', type: 'expense', spent: 180_000 },
          { categoryId: 5, name: 'Salud', type: 'expense', spent: 150_000 },
          { categoryId: 6, name: 'Ahorro', type: 'transfer', spent: 120_000 },
        ],
      },
      {
        currency: 'USD',
        income: 1_200,
        incomePayments: 1,
        spent: 300,
        committed: 0,
        history: historyEndingIn(month, [[1_200, 300]]),
        categories: [{ categoryId: 7, name: 'Software', type: 'expense', spent: 300 }],
      },
    ],
  };
}

/** Repositorio en memoria para los specs: guarda los meses pedidos y puede fallar a demanda. */
export class FakeMonthSummaryRepository extends MonthSummaryRepository {
  /** Respuesta por mes (`yyyy-MM`); sin entrada, devuelve `sampleMonthSummary`. */
  readonly summaries: Record<string, MonthSummary> = {};
  readonly requested: SummaryMonth[] = [];
  failWith: Error | null = null;

  summary(month: SummaryMonth): Observable<MonthSummary> {
    this.requested.push(month);

    if (this.failWith) {
      const error = this.failWith;
      this.failWith = null;

      return throwError(() => error);
    }

    const key = `${month.year}-${String(month.month).padStart(2, '0')}`;

    return of(this.summaries[key] ?? sampleMonthSummary(month));
  }
}
