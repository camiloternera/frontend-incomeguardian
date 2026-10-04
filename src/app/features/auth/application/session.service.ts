import { Injectable, inject } from '@angular/core';
import { AuthSession } from '../domain/auth-session';
import { SessionStore } from '../domain/session.store';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly sessionStore = inject(SessionStore);

  current(): AuthSession | null {
    return this.sessionStore.read();
  }

  clear(): void {
    this.sessionStore.clear();
  }
}
