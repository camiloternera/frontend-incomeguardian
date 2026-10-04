import { Observable } from 'rxjs';
import { AuthSession } from './auth-session';
import { Credentials } from './credentials';
import { NewUser } from './new-user';

/** Port: how the auth domain reaches the backend. Implemented in infrastructure. */
export abstract class AuthRepository {
  abstract login(credentials: Credentials): Observable<AuthSession>;

  /** Fails with an `AuthError` when the backend rejects the user. */
  abstract register(user: NewUser): Observable<void>;
}
