import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AuthError } from '../domain/auth-error';
import { AuthRepository } from '../domain/auth.repository';
import { AuthSession } from '../domain/auth-session';
import { SessionStore } from '../domain/session.store';
import { LogoutUseCase } from './logout.use-case';

const SESSION: AuthSession = {
  userId: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-12-01T00:00:00Z',
};

/** Sesión en memoria. */
class MemorySessionStore extends SessionStore {
  session: AuthSession | null = SESSION;

  save(session: AuthSession): void {
    this.session = session;
  }

  read(): AuthSession | null {
    return this.session;
  }

  clear(): void {
    this.session = null;
  }
}

/** Repositorio que responde lo que diga `result` y anota qué se llamó. */
class StubAuthRepository extends AuthRepository {
  result: Observable<void> = of(undefined);
  calls: string[] = [];

  login(): Observable<AuthSession> {
    return of(SESSION);
  }

  register(): Observable<void> {
    return of(undefined);
  }

  confirmEmail(): Observable<void> {
    return of(undefined);
  }

  logout(): Observable<void> {
    this.calls.push('logout');
    return this.result;
  }
}

describe('LogoutUseCase', () => {
  let store: MemorySessionStore;
  let repository: StubAuthRepository;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    store = new MemorySessionStore();
    repository = new StubAuthRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionStore, useValue: store },
        { provide: AuthRepository, useValue: repository },
      ],
    });
    useCase = TestBed.inject(LogoutUseCase);
  });

  it('revokes the current session and clears the local tokens', () => {
    let completed = false;
    useCase.execute().subscribe({ complete: () => (completed = true) });

    expect(repository.calls).toEqual(['logout']);
    expect(store.session).toBeNull();
    expect(completed).toBe(true);
  });

  it('still signs out locally when the backend fails', () => {
    repository.result = throwError(() => new AuthError('down'));
    let completed = false;
    useCase.execute().subscribe({ complete: () => (completed = true) });

    expect(store.session).toBeNull();
    expect(completed).toBe(true);
  });
});
