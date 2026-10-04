import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { resolveApiError } from '@core/http/api-error';
import { AuthError } from '../domain/auth-error';
import { AuthRepository } from '../domain/auth.repository';
import { AuthSession } from '../domain/auth-session';
import { Credentials } from '../domain/credentials';
import { NewUser } from '../domain/new-user';
import { AUTH_ERROR_MESSAGES } from './auth-error-messages';
import { LoginResponseDto } from './auth.dto';

function toSession(dto: LoginResponseDto): AuthSession {
  return {
    userId: dto.UserId,
    email: dto.Email,
    name: dto.Name,
    accessToken: dto.AccessToken,
    refreshToken: dto.RefreshToken,
    expiresAt: dto.ExpiresAt,
  };
}

@Injectable()
export class AuthHttpRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly loginUrl = `${environment.apiUrl}/api/v1/User/login`;
  private readonly registerUrl = `${environment.apiUrl}/api/v1/User`;

  login(credentials: Credentials): Observable<AuthSession> {
    return this.http.post<LoginResponseDto>(this.loginUrl, credentials).pipe(map(toSession));
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
        throwError(() => new AuthError(resolveApiError(error, AUTH_ERROR_MESSAGES))),
      ),
    );
  }
}
