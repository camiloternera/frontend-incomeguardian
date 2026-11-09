import { Observable } from 'rxjs';
import { MonthSummary, SummaryMonth } from './month-summary';

/** Puerto: de dónde salen las cifras del mes del Resumen. Se implementa en infrastructure. */
export abstract class MonthSummaryRepository {
  abstract summary(month: SummaryMonth): Observable<MonthSummary>;
}
