import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';
import { LanguageService } from './language.service';

/**
 * Tells the API which culture to answer in. The backend only declares `es-CO` and
 * `en-US`, so the exact culture is sent rather than a bare `es` / `en`.
 */
export const acceptLanguageInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiUrl)) {
    return next(request);
  }

  const language = inject(LanguageService).language();
  return next(request.clone({ setHeaders: { 'Accept-Language': language } }));
};
