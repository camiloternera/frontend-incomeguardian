import { Language } from '@core/i18n/language';
import { ThemeName } from '@core/theme/theme-name';

/** Preferencias de apariencia guardadas en la cuenta del usuario. */
export interface UserPreferences {
  theme: ThemeName;
  language: Language;
}
