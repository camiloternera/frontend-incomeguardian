import { Observable } from 'rxjs';
import { UserPreferences } from './user-preferences';

/**
 * Puerto: cómo llega el dominio de ajustes a las preferencias guardadas en la cuenta.
 * Se implementa en infrastructure. Todo fallo llega como `PreferencesError`.
 */
export abstract class PreferencesRepository {
  /** Las preferencias guardadas del usuario autenticado. */
  abstract get(): Observable<UserPreferences>;

  /** Reemplaza las preferencias guardadas y devuelve las que quedaron. */
  abstract save(preferences: UserPreferences): Observable<UserPreferences>;
}
