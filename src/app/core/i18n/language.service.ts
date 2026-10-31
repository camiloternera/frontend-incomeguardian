import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { LANGUAGES, Language, isLanguage } from './language';

export { LANGUAGES, isLanguage };
export type { Language };

export interface LanguageOption {
  id: Language;
  label: string;
  /** Each language names itself, so the option is readable whatever is active. */
  name: string;
}

const STORAGE_KEY = 'income-guardian.language';

/** Spanish browsers get Spanish; everyone else gets English. */
export function languageFromBrowser(browserLanguage: string | undefined): Language {
  return browserLanguage?.toLowerCase().startsWith('es') ? 'es-CO' : 'en-US';
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  readonly languages: readonly LanguageOption[] = [
    { id: 'es-CO', label: 'ES', name: 'Español' },
    { id: 'en-US', label: 'EN', name: 'English' },
  ];

  readonly language = signal<Language>(this.readInitialLanguage());

  constructor() {
    // Set synchronously so the first render only loads the language it will show.
    this.applyToTransloco(this.language());

    effect(() => {
      const language = this.language();
      this.applyToTransloco(language);
      document.documentElement.lang = language;

      try {
        localStorage.setItem(STORAGE_KEY, language);
      } catch {
        // Storage can be unavailable in private browsing. The language still applies.
      }
    });
  }

  setLanguage(language: Language): void {
    this.language.set(language);
  }

  /**
   * Transloco re-renders every `*transloco` view on each `setActiveLang`, even for
   * the language already active. Skipping no-ops keeps a view from re-rendering
   * while it is still being created (this service is first injected mid-render).
   */
  private applyToTransloco(language: Language): void {
    if (this.transloco.getActiveLang() !== language) {
      this.transloco.setActiveLang(language);
    }
  }

  private readInitialLanguage(): Language {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored)) {
        return stored;
      }
    } catch {
      // Fall through to the browser preference.
    }

    return languageFromBrowser(typeof navigator === 'undefined' ? undefined : navigator.language);
  }
}
