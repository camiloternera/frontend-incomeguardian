import { Provider } from '@angular/core';
import { AuthRepository } from './domain/auth.repository';
import { SessionStore } from './domain/session.store';
import { AuthHttpRepository } from './infrastructure/auth-http.repository';
import { SessionStorageStore } from './infrastructure/session-storage.store';

/** Binds the auth ports to their adapters. Registered once in `app.config.ts`. */
export function provideAuth(): Provider[] {
  return [
    { provide: AuthRepository, useClass: AuthHttpRepository },
    { provide: SessionStore, useClass: SessionStorageStore },
  ];
}
