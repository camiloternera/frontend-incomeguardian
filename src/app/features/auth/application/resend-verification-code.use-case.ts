import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../domain/auth.repository';
import { VerificationWindow } from '../domain/verification-window';
import { browserTimeZone } from './browser-time-zone';

@Injectable({ providedIn: 'root' })
export class ResendVerificationCodeUseCase {
  private readonly repository = inject(AuthRepository);

  /** Pide un código nuevo para `email`; el anterior queda invalidado. */
  execute(email: string): Observable<VerificationWindow> {
    return this.repository.resendCode({ email, timeZone: browserTimeZone() });
  }
}
