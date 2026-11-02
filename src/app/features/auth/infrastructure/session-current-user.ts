import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CurrentUser, CurrentUserProfile } from '@core/session/current-user';
import { LogoutUseCase } from '../application/logout.use-case';
import { SessionStore } from '../domain/session.store';

/** Adaptador de `CurrentUser` sobre la sesión guardada por el dominio `auth`. */
@Injectable()
export class SessionCurrentUser extends CurrentUser {
  private readonly sessionStore = inject(SessionStore);
  private readonly logout = inject(LogoutUseCase);

  profile(): CurrentUserProfile | null {
    const session = this.sessionStore.read();

    return session ? { name: session.name, email: session.email } : null;
  }

  signOut(): Observable<void> {
    return this.logout.execute();
  }
}
