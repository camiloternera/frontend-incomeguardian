import { Injectable, inject } from '@angular/core';
import { Observable, concatMap } from 'rxjs';
import { Cushion, CushionCandidate, clampGoal } from '../domain/cushion';
import { CushionRepository } from '../domain/cushion.repository';

/** Provided with the domain in `dashboard.providers.ts`, not in the root injector. */
@Injectable()
export class GetCushionUseCase {
  private readonly repository = inject(CushionRepository);

  execute(): Observable<Cushion> {
    return this.repository.cushion();
  }
}

/** Las cuentas que la hoja del colchón ofrece para elegir. */
@Injectable()
export class GetCushionCandidatesUseCase {
  private readonly repository = inject(CushionRepository);

  execute(): Observable<CushionCandidate[]> {
    return this.repository.candidates();
  }
}

/** Guarda la hoja del colchón: primero las cuentas y luego la meta. Si una falla, el error sale tal cual. */
@Injectable()
export class SaveCushionUseCase {
  private readonly repository = inject(CushionRepository);

  execute(accountIds: readonly number[], goalMonths: number): Observable<void> {
    return this.repository.saveAccounts(accountIds).pipe(concatMap(() => this.repository.saveGoal(clampGoal(goalMonths))));
  }
}
