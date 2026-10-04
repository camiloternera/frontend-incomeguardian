import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthRepository } from '../domain/auth.repository';
import { AuthSession } from '../domain/auth-session';
import { Credentials } from '../domain/credentials';
import { SessionStore } from '../domain/session.store';

@Injectable({ providedIn: 'root' })
export class LoginUseCase {
  private readonly repository = inject(AuthRepository);
  private readonly sessionStore = inject(SessionStore);

  execute(credentials: Credentials): Observable<AuthSession> {
    return this.repository.login(credentials).pipe(tap((session) => this.sessionStore.save(session)));
  }
}
