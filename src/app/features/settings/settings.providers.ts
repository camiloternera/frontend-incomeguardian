import { Provider } from '@angular/core';
import { ApplyPreferences, LoadPreferencesUseCase, SavePreferencesUseCase } from './application/preferences-use-cases';
import { PreferencesRepository } from './domain/preferences.repository';
import { PreferencesHttpRepository } from './infrastructure/preferences-http.repository';

/**
 * Enlaza el puerto de preferencias con su adaptador. Se registra en `settings.routes.ts`
 * para que el adaptador quede dentro del chunk diferido, igual que en categorías.
 */
export function provideSettings(): Provider[] {
  return [
    { provide: PreferencesRepository, useClass: PreferencesHttpRepository },
    ApplyPreferences,
    LoadPreferencesUseCase,
    SavePreferencesUseCase,
  ];
}
