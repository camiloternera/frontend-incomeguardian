import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RECENT_MOVEMENTS_LIMIT, RecentMovement } from '../domain/recent-movement';
import { RecentMovementsRepository } from '../domain/recent-movements.repository';

/** Pide los últimos movimientos para «Movimientos recientes». Se provee en `dashboard.providers.ts`. */
@Injectable()
export class GetRecentMovementsUseCase {
  private readonly repository = inject(RecentMovementsRepository);

  execute(limit = RECENT_MOVEMENTS_LIMIT): Observable<RecentMovement[]> {
    return this.repository.recent(limit);
  }
}
