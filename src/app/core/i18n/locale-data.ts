import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';

/**
 * Angular ships en-US data; es-CO has to be registered before the date, number
 * and currency pipes can format in it. Importing this module is the whole point,
 * so anything that formats for a user — the app and the tests — pulls it in.
 */
registerLocaleData(localeEsCO);
