import { Observable } from 'rxjs';
import { AuthSession } from './auth-session';
import { Credentials } from './credentials';
import { EmailConfirmation } from './email-confirmation';
import { NewUser } from './new-user';
import { CodeResendRequest, VerificationWindow } from './verification-window';

/** Port: how the auth domain reaches the backend. Implemented in infrastructure. */
export abstract class AuthRepository {
  abstract login(credentials: Credentials): Observable<AuthSession>;

  /**
   * Inicia el registro y devuelve los plazos del código enviado al correo.
   * Fails with an `AuthError` when the backend rejects the user.
   */
  abstract register(user: NewUser): Observable<VerificationWindow>;

  /** Fails with an `AuthError` when the code is wrong, expired or out of attempts. */
  abstract confirmEmail(confirmation: EmailConfirmation): Observable<void>;

  /**
   * Envía un código nuevo para un registro pendiente, aunque el anterior haya vencido.
   * Falla con un `AuthError` (`resendTooSoon`, `registrationNotFound`, `alreadyRegistered`).
   */
  abstract resendCode(request: CodeResendRequest): Observable<VerificationWindow>;

  /** Revoca en el backend solo la sesión actual. Falla con un `AuthError`. */
  abstract logout(): Observable<void>;
}
