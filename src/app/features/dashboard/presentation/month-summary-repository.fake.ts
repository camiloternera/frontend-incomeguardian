import { Observable, of, throwError } from 'rxjs';
import { MonthSummary, SummaryMonth } from '../domain/month-summary';
import { MonthSummaryRepository } from '../domain/month-summary.repository';

/** Cifras de ejemplo en pesos y dólares, iguales a las del diseño del Resumen. */
export function sampleMonthSummary({ year, month }: SummaryMonth): MonthSummary {
  return {
    year,
    month,
    currencies: [
      { currency: 'COP', income: 6_200_000, incomePayments: 3, spent: 2_360_000, committed: 1_000_000 },
      { currency: 'USD', income: 1_200, incomePayments: 1, spent: 300, committed: 0 },
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
