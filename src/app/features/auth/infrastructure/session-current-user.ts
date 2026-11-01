import { Injectable, inject } from '@angular/core';
import { CurrentUser, CurrentUserProfile } from '@core/session/current-user';
import { SessionStore } from '../domain/session.store';

/** Adaptador de `CurrentUser` sobre la sesión guardada por el dominio `auth`. */
@Injectable()
export class SessionCurrentUser extends CurrentUser {
  private readonly sessionStore = inject(SessionStore);

  profile(): CurrentUserProfile | null {
    const session = this.sessionStore.read();

    return session ? { name: session.name, email: session.email } : null;
  }

  signOut(): void {
    this.sessionStore.clear();
  }
}
