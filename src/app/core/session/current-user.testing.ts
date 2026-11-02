import { Observable, of } from 'rxjs';
import { CurrentUser, CurrentUserProfile } from './current-user';

/** Usuario falso para los tests: guarda si se pidió cerrar la sesión. */
export class FakeCurrentUser extends CurrentUser {
  signedOut = false;

  constructor(
    private readonly user: CurrentUserProfile | null = {
      name: 'Camila Rojas',
      email: 'camila@example.com',
    },
  ) {
    super();
  }

  profile(): CurrentUserProfile | null {
    return this.signedOut ? null : this.user;
  }

  signOut(): Observable<void> {
    this.signedOut = true;
    return of(undefined);
  }
}
