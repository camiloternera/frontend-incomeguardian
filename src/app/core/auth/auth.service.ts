import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from './auth.models';

const SESSION_KEY = 'income-guardian.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly loginUrl = `${environment.apiUrl}/api/v1/User/login`;

  login(credentials: LoginRequest): Observable<LoginResponse> {  
    return this.http.post<LoginResponse>(this.loginUrl, credentials).pipe(
      tap((session) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))),
    );
  }

  getSession(): LoginResponse | null {
    const session = sessionStorage.getItem(SESSION_KEY);

    if (!session) {
      return null;
    }

    try {
      return JSON.parse(session) as LoginResponse;
    } catch {
      this.clearSession();
      return null;
    }
  }

  clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
