import { AuthSession } from './auth-session';

/** Port: where the active session is persisted. Implemented in infrastructure. */
export abstract class SessionStore {
  abstract save(session: AuthSession): void;
  abstract read(): AuthSession | null;
  abstract clear(): void;
}
