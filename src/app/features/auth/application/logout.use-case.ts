import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, of } from 'rxjs';
import { AuthRepository } from '../domain/auth.repository';
import { SessionStore } from '../domain/session.store';

@Injectable({ providedIn: 'root' })
export class LogoutUseCase {
  private readonly repository = inject(AuthRepository);
  private readonly sessionStore = inject(SessionStore);

  /**
   * Cierra la sesión de este dispositivo. Los tokens locales se borran aunque el backend
   * no responda: quien pide salir debe quedar fuera, y el token caduca por sí solo.
   */
  execute(): Observable<void> {
    return this.repository.logout().pipe(
      catchError(() => of(undefined)),
      finalize(() => this.sessionStore.clear()),
    );
  }
}
