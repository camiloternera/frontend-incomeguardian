import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { acceptLanguageInterceptor } from '@core/i18n/accept-language.interceptor';
import { provideI18n } from '@core/i18n/i18n.providers';
import { provideAuth } from '@features/auth/auth.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([acceptLanguageInterceptor])),
    provideI18n(),
    provideAuth(),
  ]
};
