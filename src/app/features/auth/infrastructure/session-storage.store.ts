import { Injectable } from '@angular/core';
import { AuthSession } from '../domain/auth-session';
import { SessionStore } from '../domain/session.store';

const SESSION_KEY = 'income-guardian.session';

@Injectable()
export class SessionStorageStore extends SessionStore {
  save(session: AuthSession): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  read(): AuthSession | null {
    const session = sessionStorage.getItem(SESSION_KEY);

    if (!session) {
      return null;
    }

    try {
      return JSON.parse(session) as AuthSession;
    } catch {
      this.clear();
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
