import { TranslocoTestingModule, TranslocoTestingOptions } from '@jsverse/transloco';
import enUS from '../../../../public/i18n/en-US.json';
import esCO from '../../../../public/i18n/es-CO.json';
import authEnUS from '../../../../public/i18n/auth/en-US.json';
import authEsCO from '../../../../public/i18n/auth/es-CO.json';
import dashboardEnUS from '../../../../public/i18n/dashboard/en-US.json';
import dashboardEsCO from '../../../../public/i18n/dashboard/es-CO.json';
import categoriesEnUS from '../../../../public/i18n/categories/en-US.json';
import categoriesEsCO from '../../../../public/i18n/categories/es-CO.json';
import accountsEnUS from '../../../../public/i18n/accounts/en-US.json';
import accountsEsCO from '../../../../public/i18n/accounts/es-CO.json';
import transactionsEnUS from '../../../../public/i18n/transactions/en-US.json';
import transactionsEsCO from '../../../../public/i18n/transactions/es-CO.json';
import settingsEnUS from '../../../../public/i18n/settings/en-US.json';
import settingsEsCO from '../../../../public/i18n/settings/es-CO.json';
import budgetsEnUS from '../../../../public/i18n/budgets/en-US.json';
import budgetsEsCO from '../../../../public/i18n/budgets/es-CO.json';
import periodsEnUS from '../../../../public/i18n/periods/en-US.json';
import periodsEsCO from '../../../../public/i18n/periods/es-CO.json';
import { LANGUAGES } from './language.service';
import './locale-data';

/** Real translations, loaded synchronously and merged the way the scopes are at runtime. */
export function translocoTesting(options: TranslocoTestingOptions = {}) {
  return TranslocoTestingModule.forRoot({
    langs: {
      'en-US': { ...enUS, auth: authEnUS, dashboard: dashboardEnUS, categories: categoriesEnUS, accounts: accountsEnUS, settings: settingsEnUS, transactions: transactionsEnUS, periods: periodsEnUS, budgets: budgetsEnUS },
      'es-CO': { ...esCO, auth: authEsCO, dashboard: dashboardEsCO, categories: categoriesEsCO, accounts: accountsEsCO, settings: settingsEsCO, transactions: transactionsEsCO, periods: periodsEsCO, budgets: budgetsEsCO },
    },
    translocoConfig: { availableLangs: [...LANGUAGES], defaultLang: 'en-US', reRenderOnLangChange: true },
    preloadLangs: true,
    ...options,
  });
}
