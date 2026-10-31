import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { resolveApiError } from '@core/http/api-error';
import { isLanguage } from '@core/i18n/language';
import { isThemeName } from '@core/theme/theme-name';
import { AuthError } from '../domain/auth-error';
import { AuthRepository } from '../domain/auth.repository';
import { AuthSession } from '../domain/auth-session';
import { Credentials } from '../domain/credentials';
import { EmailConfirmation } from '../domain/email-confirmation';
import { NewUser } from '../domain/new-user';
import { AUTH_ERROR_KEYS } from './auth-error-messages';
import { ConfirmedUserDto, LoginResponseDto } from './auth.dto';

function toSession(dto: LoginResponseDto): AuthSession {
  return {
    userId: dto.userId,
    email: dto.email,
    name: dto.name,
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    expiresAt: dto.expiresAt,
    // Un valor desconocido se descarta para no romper el tema ni el idioma de la app.
    theme: isThemeName(dto.theme) ? dto.theme : undefined,
    language: isLanguage(dto.language) ? dto.language : undefined,
  };
}

@Injectable()
export class AuthHttpRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly loginUrl = `${environment.apiUrl}/api/v1/User/login`;
  private readonly registerUrl = `${environment.apiUrl}/api/v1/User`;
  private readonly confirmUrl = `${environment.apiUrl}/api/v1/User/confirm`;

  login(credentials: Credentials): Observable<AuthSession> {
    return this.http.post<ApiResponse<LoginResponseDto>>(this.loginUrl, credentials).pipe(
      map((response) => {
        // Sin token no hay sesión: un sobre fallido o vacío se trata como error de login.
        if (!response?.isSuccess || !response.data?.accessToken) {
          throw response;
        }

        return toSession(response.data);
      }),
    );
  }

  register(user: NewUser): Observable<void> {
    return this.http.post<ApiResponse<unknown>>(this.registerUrl, user).pipe(
      map((response) => {
        // The API answers 200 with `isSuccess: false` for business failures.
        if (!response?.isSuccess) {
          throw response;
        }
      }),
      catchError((error: unknown) =>
        throwError(() => new AuthError(this.toMessage(error))),
      ),
    );
  }

  confirmEmail(confirmation: EmailConfirmation): Observable<void> {
    return this.http.post<ApiResponse<ConfirmedUserDto>>(this.confirmUrl, confirmation).pipe(
      map((response) => {
        // A 2xx is a success unless the envelope says otherwise.
        if (response && response.isSuccess === false) {
          throw response;
        }
      }),
      catchError((error: unknown) =>
        throwError(() => new AuthError(this.toMessage(error))),
      ),
    );
  }

  private toMessage(error: unknown): string {
    return resolveApiError(error, AUTH_ERROR_KEYS, (key) => this.transloco.translate(key));
  }
}
