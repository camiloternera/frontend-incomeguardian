import { Language } from '@core/i18n/language';
import { ThemeName } from '@core/theme/theme-name';

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  /** Tema guardado en la cuenta; falta si el backend no lo envió o no es válido. */
  theme?: ThemeName;
  /** Idioma guardado en la cuenta; falta si el backend no lo envió o no es válido. */
  language?: Language;
}
