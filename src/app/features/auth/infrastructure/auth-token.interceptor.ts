import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { SessionStore } from '../domain/session.store';

/**
 * Adjunta el token de acceso a las peticiones dirigidas a la API.
 * Si la API responde 401 con una sesión guardada, la sesión ya no sirve: se borra
 * y se envía al usuario al login conservando la ruta a la que quería volver.
 */
export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionStore = inject(SessionStore);
  const router = inject(Router);
  const session = sessionStore.read();

  if (!session || !request.url.startsWith(environment.apiUrl)) {
    return next(request);
  }

  const authorized = request.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } });

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.Unauthorized) {
        sessionStore.clear();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }

      return throwError(() => error);
    }),
  );
};
