import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../../application/session.service';

/** Keeps the private routes behind a stored session. */
export const sessionGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService).current();

  if (session) {
    return true;
  }

  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
