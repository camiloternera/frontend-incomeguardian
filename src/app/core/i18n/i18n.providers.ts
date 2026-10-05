import { EnvironmentProviders, Provider, inject, isDevMode, provideAppInitializer } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { LANGUAGES, LanguageService } from './language.service';
import { TranslocoHttpLoader } from './transloco-http.loader';

/** Registers Transloco and applies the stored or detected language at startup. */
export function provideI18n(): (Provider | EnvironmentProviders)[] {
  return [
    provideTransloco({
      config: {
        availableLangs: [...LANGUAGES],
        defaultLang: 'en-US',
        fallbackLang: 'en-US',
        reRenderOnLangChange: true,
        missingHandler: { useFallbackTranslation: true },
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      inject(LanguageService);
    }),
  ];
}
