import { Provider } from '@angular/core';
import {
  CreateTransactionUseCase,
  DeleteTransactionUseCase,
  GetExchangeRateUseCase,
  GetTransactionUseCase,
  PreviewInstallmentsUseCase,
  SummarizeTransactionsUseCase,
  UpdateTransactionUseCase,
  ListTransactionAccountOptionsUseCase,
  ListTransactionCategoryOptionsUseCase,
  ListTransactionsUseCase,
} from './application/transaction-use-cases';
import {
  ExchangeRateRepository,
  TransactionAccountOptionsRepository,
  TransactionCategoryOptionsRepository,
  TransactionRepository,
} from './domain/transaction.repository';
import {
  ExchangeRateHttpRepository,
  TransactionAccountOptionsHttpRepository,
  TransactionCategoryOptionsHttpRepository,
  TransactionHttpRepository,
} from './infrastructure/transaction-http.repository';

/** Casos de uso del dominio; los tests los registran junto con puertos falsos. */
export const TRANSACTION_USE_CASES: Provider[] = [
  ListTransactionsUseCase,
  SummarizeTransactionsUseCase,
  CreateTransactionUseCase,
  UpdateTransactionUseCase,
  DeleteTransactionUseCase,
  GetTransactionUseCase,
  PreviewInstallmentsUseCase,
  GetExchangeRateUseCase,
  ListTransactionAccountOptionsUseCase,
  ListTransactionCategoryOptionsUseCase,
];

/**
 * Enlaza los puertos de movimientos con sus adaptadores. Se registra en `transactions.routes.ts`
 * para que los adaptadores queden dentro del chunk diferido.
 */
export function provideTransactions(): Provider[] {
  return [
    { provide: TransactionRepository, useClass: TransactionHttpRepository },
    { provide: TransactionAccountOptionsRepository, useClass: TransactionAccountOptionsHttpRepository },
    { provide: TransactionCategoryOptionsRepository, useClass: TransactionCategoryOptionsHttpRepository },
    { provide: ExchangeRateRepository, useClass: ExchangeRateHttpRepository },
    ...TRANSACTION_USE_CASES,
  ];
}
