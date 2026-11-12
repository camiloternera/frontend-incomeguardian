import { Transaction } from '../domain/transaction';

type NamedTransaction = Pick<Transaction, 'description' | 'type' | 'isCardAdvance' | 'parentTransactionId'>;

/**
 * Clave de traducción con la que se nombra un movimiento sin descripción: la comisión de un avance,
 * un avance o, en cualquier otro caso, su tipo.
 */
export function transactionNameKey(transaction: NamedTransaction): string {
  if (transaction.parentTransactionId !== null) {
    return 'transactions.list.feeOf';
  }

  return transaction.isCardAdvance ? 'transactions.list.advance' : `transactions.types.${transaction.type}`;
}

/** Nombre visible de un movimiento: su descripción o, si no tiene, lo que es. */
export function transactionName(transaction: NamedTransaction, translate: (key: string) => string): string {
  return transaction.description || translate(transactionNameKey(transaction));
}
