import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MonthSummary, SummaryMonth } from '../domain/month-summary';
import { MonthSummaryRepository } from '../domain/month-summary.repository';

/** Pide las cifras de un mes para el bloque principal del Resumen. Se provee en `dashboard.providers.ts`. */
@Injectable()
export class GetMonthSummaryUseCase {
  private readonly repository = inject(MonthSummaryRepository);

  execute(month: SummaryMonth): Observable<MonthSummary> {
    return this.repository.summary(month);
  }
}
