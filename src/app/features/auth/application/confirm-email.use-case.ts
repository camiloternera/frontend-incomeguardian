import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../domain/auth.repository';
import { EmailConfirmation } from '../domain/email-confirmation';

@Injectable({ providedIn: 'root' })
export class ConfirmEmailUseCase {
  private readonly repository = inject(AuthRepository);

  execute(confirmation: EmailConfirmation): Observable<void> {
    return this.repository.confirmEmail(confirmation);
  }
}
