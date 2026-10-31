import { TranslocoTestingModule, TranslocoTestingOptions } from '@jsverse/transloco';
import enUS from '../../../../public/i18n/en-US.json';
import esCO from '../../../../public/i18n/es-CO.json';
import authEnUS from '../../../../public/i18n/auth/en-US.json';
import authEsCO from '../../../../public/i18n/auth/es-CO.json';
import dashboardEnUS from '../../../../public/i18n/dashboard/en-US.json';
import dashboardEsCO from '../../../../public/i18n/dashboard/es-CO.json';
import categoriesEnUS from '../../../../public/i18n/categories/en-US.json';
import categoriesEsCO from '../../../../public/i18n/categories/es-CO.json';
import { LANGUAGES } from './language.service';
import './locale-data';

/** Real translations, loaded synchronously and merged the way the scopes are at runtime. */
export function translocoTesting(options: TranslocoTestingOptions = {}) {
  return TranslocoTestingModule.forRoot({
    langs: {
      'en-US': { ...enUS, auth: authEnUS, dashboard: dashboardEnUS, categories: categoriesEnUS },
      'es-CO': { ...esCO, auth: authEsCO, dashboard: dashboardEsCO, categories: categoriesEsCO },
    },
    translocoConfig: { availableLangs: [...LANGUAGES], defaultLang: 'en-US', reRenderOnLangChange: true },
    preloadLangs: true,
    ...options,
  });
}
