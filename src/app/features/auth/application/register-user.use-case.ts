import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../domain/auth.repository';
import { NewUser } from '../domain/new-user';
import { VerificationWindow } from '../domain/verification-window';
import { browserTimeZone } from './browser-time-zone';

@Injectable({ providedIn: 'root' })
export class RegisterUserUseCase {
  private readonly repository = inject(AuthRepository);

  /** Registra al usuario con la zona horaria del navegador y devuelve los plazos del código. */
  execute(user: NewUser): Observable<VerificationWindow> {
    return this.repository.register({ ...user, timeZone: user.timeZone ?? browserTimeZone() });
  }
}
