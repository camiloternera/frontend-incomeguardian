import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../domain/auth.repository';
import { NewUser } from '../domain/new-user';

@Injectable({ providedIn: 'root' })
export class RegisterUserUseCase {
  private readonly repository = inject(AuthRepository);

  execute(user: NewUser): Observable<void> {
    return this.repository.register(user);
  }
}
