import { Provider } from '@angular/core';
import { CurrentUser } from '@core/session/current-user';
import { AuthRepository } from './domain/auth.repository';
import { SessionStore } from './domain/session.store';
import { AuthHttpRepository } from './infrastructure/auth-http.repository';
import { SessionCurrentUser } from './infrastructure/session-current-user';
import { SessionStorageStore } from './infrastructure/session-storage.store';

/** Binds the auth ports to their adapters. Registered once in `app.config.ts`. */
export function provideAuth(): Provider[] {
  return [
    { provide: AuthRepository, useClass: AuthHttpRepository },
    { provide: SessionStore, useClass: SessionStorageStore },
    { provide: CurrentUser, useClass: SessionCurrentUser },
  ];
}
