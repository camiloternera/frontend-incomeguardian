import { Observable } from 'rxjs';
import { Account, AccountDraft } from './account';

/**
 * Puerto: cómo llega el dominio de cuentas al backend. Se implementa en infrastructure.
 * Todo fallo llega como `AccountError`.
 */
export abstract class AccountRepository {
  /** Cuentas del usuario, activas y desactivadas. */
  abstract list(): Observable<Account[]>;

  /** Una cuenta del usuario por su identificador, aunque esté desactivada. */
  abstract get(id: number): Observable<Account>;

  /** Crea una cuenta para el usuario. */
  abstract create(draft: AccountDraft): Observable<Account>;

  /** Actualiza una cuenta activa del usuario. */
  abstract update(id: number, draft: AccountDraft): Observable<Account>;

  /** El backend desactiva la cuenta; sigue apareciendo en `list` con `isActive` en false. */
  abstract deactivate(id: number): Observable<void>;
}
