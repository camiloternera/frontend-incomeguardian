import { Observable } from 'rxjs';
import { AccountType, AccountTypeDraft } from './account-type';

/**
 * Puerto: cómo llega el dominio de tipos de cuenta al backend. Se implementa en infrastructure.
 * Todo fallo llega como `AccountTypeError`.
 */
export abstract class AccountTypeRepository {
  /** Tipos de cuenta activos del usuario. */
  abstract list(): Observable<AccountType[]>;

  /** Un tipo de cuenta activo del usuario por su identificador. */
  abstract get(id: number): Observable<AccountType>;

  /** Crea un tipo de cuenta para el usuario. */
  abstract create(draft: AccountTypeDraft): Observable<AccountType>;

  /** Actualiza un tipo de cuenta activo del usuario. */
  abstract update(id: number, draft: AccountTypeDraft): Observable<AccountType>;

  /** El backend desactiva el tipo: deja de aparecer en `list` y las cuentas que lo usan lo conservan. */
  abstract deactivate(id: number): Observable<void>;
}
