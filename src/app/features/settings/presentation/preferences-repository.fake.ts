import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { provideSettings } from '../settings.providers';
import { PreferencesError } from '../domain/preferences-error';
import { PreferencesRepository } from '../domain/preferences.repository';
import { UserPreferences } from '../domain/user-preferences';

/** Repositorio en memoria para los tests; `failWith` fuerza el siguiente error. */
export class FakePreferencesRepository extends PreferencesRepository {
  stored: UserPreferences = { theme: 'noir', language: 'en-US' };
  failWith: PreferencesError | null = null;
  saved: UserPreferences[] = [];

  get(): Observable<UserPreferences> {
    return this.respond(() => ({ ...this.stored }));
  }

  save(preferences: UserPreferences): Observable<UserPreferences> {
    return this.respond(() => {
      this.saved.push(preferences);
      this.stored = { ...preferences };
      return { ...preferences };
    });
  }

  private respond<T>(value: () => T): Observable<T> {
    const error = this.failWith;
    this.failWith = null;

    return error ? throwError(() => error) : of(value());
  }
}

/** Los proveedores reales del dominio, con el repositorio HTTP sustituido por el falso. */
export function provideFakeSettings(fake: FakePreferencesRepository): Provider[] {
  return [...provideSettings(), { provide: PreferencesRepository, useValue: fake }];
}
