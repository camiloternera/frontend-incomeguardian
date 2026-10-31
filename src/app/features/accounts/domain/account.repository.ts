import { Observable } from 'rxjs';
import { Account, AccountDraft, AccountTypeOption } from './account';

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

/**
 * Puerto: los tipos de cuenta activos que se pueden asignar a una cuenta. Vive en este dominio
 * porque un dominio no importa de otro; su adaptador consulta el mismo backend que `account-types`.
 */
export abstract class AccountTypeOptionsRepository {
  abstract list(): Observable<AccountTypeOption[]>;
}
