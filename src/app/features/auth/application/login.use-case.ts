import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { AuthRepository } from '../domain/auth.repository';
import { AuthSession } from '../domain/auth-session';
import { Credentials } from '../domain/credentials';
import { SessionStore } from '../domain/session.store';

@Injectable({ providedIn: 'root' })
export class LoginUseCase {
  private readonly repository = inject(AuthRepository);
  private readonly sessionStore = inject(SessionStore);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);

  /** Inicia sesión, guarda la sesión y aplica el tema y el idioma guardados en la cuenta. */
  execute(credentials: Credentials): Observable<AuthSession> {
    return this.repository.login(credentials).pipe(
      tap((session) => {
        this.sessionStore.save(session);

        if (session.theme) {
          this.themeService.setTheme(session.theme);
        }

        if (session.language) {
          this.languageService.setLanguage(session.language);
        }
      }),
    );
  }
}
