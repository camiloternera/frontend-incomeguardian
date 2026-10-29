import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardOverview } from '../domain/dashboard-overview';
import { DashboardRepository } from '../domain/dashboard.repository';

/** Provided with the domain in `dashboard.providers.ts`, not in the root injector. */
@Injectable()
export class GetOverviewUseCase {
  private readonly repository = inject(DashboardRepository);

  execute(): Observable<DashboardOverview> {
    return this.repository.overview();
  }
}
