import { Injectable, inject } from '@angular/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PreferencesRepository } from '../domain/preferences.repository';
import { UserPreferences } from '../domain/user-preferences';

/** Aplica unas preferencias a la app: el tema al documento y el idioma a las traducciones. */
@Injectable()
export class ApplyPreferences {
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);

  current(): UserPreferences {
    return { theme: this.themeService.theme(), language: this.languageService.language() };
  }

  apply(preferences: UserPreferences): void {
    this.themeService.setTheme(preferences.theme);
    this.languageService.setLanguage(preferences.language);
  }
}

/** Lee las preferencias de la cuenta y las aplica, por si cambiaron desde otro dispositivo. */
@Injectable()
export class LoadPreferencesUseCase {
  private readonly repository = inject(PreferencesRepository);
  private readonly applyPreferences = inject(ApplyPreferences);

  execute(): Observable<UserPreferences> {
    return this.repository.get().pipe(tap((preferences) => this.applyPreferences.apply(preferences)));
  }
}

/**
 * Aplica el cambio al instante para que se vea sin esperar a la red, lo guarda en la cuenta
 * y, si el backend lo rechaza, vuelve a las preferencias anteriores.
 */
@Injectable()
export class SavePreferencesUseCase {
  private readonly repository = inject(PreferencesRepository);
  private readonly applyPreferences = inject(ApplyPreferences);

  execute(preferences: UserPreferences): Observable<UserPreferences> {
    const previous = this.applyPreferences.current();
    this.applyPreferences.apply(preferences);

    return this.repository.save(preferences).pipe(
      tap((saved) => this.applyPreferences.apply(saved)),
      catchError((error: unknown) => {
        this.applyPreferences.apply(previous);
        return throwError(() => error);
      }),
    );
  }
}
