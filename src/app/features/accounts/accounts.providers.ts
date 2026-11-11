import { Provider } from '@angular/core';
import {
  CreateAccountUseCase,
  DeactivateAccountUseCase,
  GetAccountUseCase,
  GetCardStatementUseCase,
  ListAccountsUseCase,
  UpdateAccountUseCase,
} from './application/account-use-cases';
import { AccountRepository } from './domain/account.repository';
import { AccountHttpRepository } from './infrastructure/account-http.repository';

/**
 * Enlaza los puertos de cuentas con sus adaptadores. Se registra en `accounts.routes.ts`
 * para que los adaptadores queden dentro del chunk diferido.
 */
export function provideAccounts(): Provider[] {
  return [
    { provide: AccountRepository, useClass: AccountHttpRepository },
    ListAccountsUseCase,
    GetAccountUseCase,
    CreateAccountUseCase,
    UpdateAccountUseCase,
    DeactivateAccountUseCase,
    GetCardStatementUseCase,
  ];
}
