import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { apiErrorCode, apiErrorData, resolveApiError } from '@core/http/api-error';
import { isLanguage } from '@core/i18n/language';
import { isThemeName } from '@core/theme/theme-name';
import { AuthError } from '../domain/auth-error';
import { AuthRepository } from '../domain/auth.repository';
import { AuthSession } from '../domain/auth-session';
import { Credentials } from '../domain/credentials';
import { EmailConfirmation } from '../domain/email-confirmation';
import { NewUser } from '../domain/new-user';
import { CodeResendRequest, VerificationWindow } from '../domain/verification-window';
import { AUTH_ERROR_KEYS, AUTH_ERROR_REASONS, REMAINING_ATTEMPTS_KEY } from './auth-error-messages';
import {
  ConfirmedUserDto,
  LoginResponseDto,
  RegistrationRequestedDto,
  VerificationErrorDataDto,
} from './auth.dto';

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

/**
 * Plazos del código enviado. Si el sobre llega sin datos (una API anterior al contrato),
 * conserva el correo pedido y deja las fechas vacías: la vista lo trata como plazo desconocido.
 */
function toWindow(dto: RegistrationRequestedDto | null | undefined, email: string): VerificationWindow {
  return {
    email: dto?.email || email,
    expiresAt: dto?.expiresAt ?? '',
    resendAvailableAt: dto?.resendAvailableAt ?? '',
  };
}

function readVerificationData(error: unknown): VerificationErrorDataDto {
  const data = apiErrorData(error);

  return typeof data === 'object' && data !== null ? (data as VerificationErrorDataDto) : {};
}

@Injectable()
export class AuthHttpRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly loginUrl = `${environment.apiUrl}/api/v1/User/login`;
  private readonly registerUrl = `${environment.apiUrl}/api/v1/User`;
  private readonly confirmUrl = `${environment.apiUrl}/api/v1/User/confirm`;
  private readonly resendUrl = `${environment.apiUrl}/api/v1/User/confirm/resend`;
  private readonly logoutUrl = `${environment.apiUrl}/api/v1/User/logout`;

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

  register(user: NewUser): Observable<VerificationWindow> {
    return this.http.post<ApiResponse<RegistrationRequestedDto>>(this.registerUrl, user).pipe(
      map((response) => {
        // The API answers 200 with `isSuccess: false` for business failures.
        if (!response?.isSuccess) {
          throw response;
        }

        return toWindow(response.data, user.email);
      }),
      catchError((error: unknown) => throwError(() => this.toAuthError(error))),
    );
  }

  resendCode(request: CodeResendRequest): Observable<VerificationWindow> {
    return this.http.post<ApiResponse<RegistrationRequestedDto>>(this.resendUrl, request).pipe(
      map((response) => {
        if (!response?.isSuccess) {
          throw response;
        }

        return toWindow(response.data, request.email);
      }),
      catchError((error: unknown) => throwError(() => this.toAuthError(error))),
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
      catchError((error: unknown) => throwError(() => this.toAuthError(error))),
    );
  }

  logout(): Observable<void> {
    return this.revoke(this.logoutUrl);
  }

  /**
   * Pide al backend revocar la sesión; responde 204 sin cuerpo. Un 401 significa que el token
   * ya no era válido (la sesión se cerró en otro lado), así que el objetivo ya se cumplió.
   */
  private revoke(url: string): Observable<void> {
    return this.http.post<void>(url, null).pipe(
      map(() => undefined),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.Unauthorized
          ? of(undefined)
          : throwError(() => new AuthError(this.toMessage(error))),
      ),
    );
  }

  private toMessage(error: unknown): string {
    return resolveApiError(error, AUTH_ERROR_KEYS, (key) => this.transloco.translate(key));
  }

  /**
   * Traduce el fallo a copy de UI y conserva el motivo y los datos que la vista necesita:
   * hasta cuándo esperar para reenviar y, en un código incorrecto, los intentos que quedan.
   */
  private toAuthError(error: unknown): AuthError {
    const code = apiErrorCode(error);
    const data = readVerificationData(error);
    const remaining = data.remainingAttempts;
    const message =
      code === 'VERIFICATION_CODE_INVALID' && typeof remaining === 'number'
        ? this.transloco.translate(REMAINING_ATTEMPTS_KEY, { count: remaining })
        : this.toMessage(error);

    return new AuthError(message, {
      reason: code ? AUTH_ERROR_REASONS[code] : undefined,
      resendAvailableAt: typeof data.resendAvailableAt === 'string' ? data.resendAvailableAt : undefined,
    });
  }
}
