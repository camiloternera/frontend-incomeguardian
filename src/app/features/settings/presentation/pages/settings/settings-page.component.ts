import { Component, ElementRef, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCheck } from '@lucide/angular';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { Language } from '@core/i18n/language';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeName } from '@core/theme/theme-name';
import { ThemeService } from '@core/theme/theme.service';
import { AppTopBarComponent } from '@shared/ui/app-top-bar.component';
import { LoadPreferencesUseCase, SavePreferencesUseCase } from '../../../application/preferences-use-cases';
import { PreferencesError } from '../../../domain/preferences-error';
import { UserPreferences } from '../../../domain/user-preferences';

/** Estado del último guardado, que se anuncia junto al título de la vista. */
type SaveStatus = 'idle' | 'saving' | 'saved';

@Component({
  selector: 'app-settings-page',
  imports: [TranslocoDirective, AppTopBarComponent, LucideCheck],
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.css'],
})
export class SettingsPageComponent {
  private readonly loadPreferences = inject(LoadPreferencesUseCase);
  private readonly savePreferences = inject(SavePreferencesUseCase);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly theme = this.themeService.theme;
  protected readonly language = this.languageService.language;
  protected readonly themes = this.themeService.themes;
  protected readonly languages = this.languageService.languages;

  /** Mientras llegan las preferencias de la cuenta no se permite cambiarlas, para no pisarlas. */
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');
  protected readonly status = signal<SaveStatus>('idle');
  protected readonly saveError = signal('');

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.loadPreferences
      .execute()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({ error: (error: unknown) => this.loadError.set(this.messageOf(error)) });
  }

  protected chooseTheme(theme: ThemeName): void {
    this.save({ theme, language: this.language() });
  }

  protected chooseLanguage(language: Language): void {
    this.save({ theme: this.theme(), language });
  }

  private save(preferences: UserPreferences): void {
    if (preferences.theme === this.theme() && preferences.language === this.language()) {
      return;
    }

    this.status.set('saving');
    this.saveError.set('');

    this.savePreferences
      .execute(preferences)
      .pipe(finalize(() => this.syncRadios()))
      .subscribe({
        next: () => this.status.set('saved'),
        error: (error: unknown) => {
          // El caso de uso ya devolvió la app a las preferencias anteriores.
          this.status.set('idle');
          this.saveError.set(this.messageOf(error));
        },
      });
  }

  /**
   * El navegador marca el radio pulsado antes de que se guarde. Si el guardado se revierte,
   * el valor enlazado al radio anterior no cambia y Angular no lo vuelve a marcar, así que se
   * alinea el DOM con las preferencias aplicadas.
   */
  private syncRadios(): void {
    const current: Record<string, string> = { theme: this.theme(), language: this.language() };

    for (const input of this.host.nativeElement.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      input.checked = current[input.name] === input.value;
    }
  }

  private messageOf(error: unknown): string {
    return error instanceof PreferencesError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
