import { Provider } from '@angular/core';
import {
  CreateAccountTypeUseCase,
  DeactivateAccountTypeUseCase,
  GetAccountTypeUseCase,
  ListAccountTypesUseCase,
  UpdateAccountTypeUseCase,
} from './application/account-type-use-cases';
import { AccountTypeRepository } from './domain/account-type.repository';
import { AccountTypeHttpRepository } from './infrastructure/account-type-http.repository';

/**
 * Enlaza el puerto de tipos de cuenta con su adaptador. Se registra en `account-types.routes.ts`
 * para que el adaptador quede dentro del chunk diferido, igual que en categorías.
 */
export function provideAccountTypes(): Provider[] {
  return [
    { provide: AccountTypeRepository, useClass: AccountTypeHttpRepository },
    ListAccountTypesUseCase,
    GetAccountTypeUseCase,
    CreateAccountTypeUseCase,
    UpdateAccountTypeUseCase,
    DeactivateAccountTypeUseCase,
  ];
}
