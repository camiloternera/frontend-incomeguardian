import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CategoryKind,
  ExchangeRate,
  Transaction,
  TransactionAccountOption,
  TransactionCategoryOption,
  TransactionDraft,
  TransactionPage,
  TransactionQuery,
} from '../domain/transaction';
import {
  ExchangeRateRepository,
  TransactionAccountOptionsRepository,
  TransactionCategoryOptionsRepository,
  TransactionRepository,
} from '../domain/transaction.repository';

/** Ordena por nombre sin distinguir mayúsculas ni tildes. */
function byName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Recorta la descripción y la deja en null si queda vacía. */
function trimmed(draft: TransactionDraft): TransactionDraft {
  const description = draft.description?.trim() || null;
  return { ...draft, description };
}

@Injectable()
export class ListTransactionsUseCase {
  private readonly repository = inject(TransactionRepository);

  execute(query: TransactionQuery): Observable<TransactionPage> {
    return this.repository.list(query);
  }
}

@Injectable()
export class CreateTransactionUseCase {
  private readonly repository = inject(TransactionRepository);

  execute(draft: TransactionDraft): Observable<Transaction> {
    return this.repository.create(trimmed(draft));
  }
}

@Injectable()
export class GetExchangeRateUseCase {
  private readonly repository = inject(ExchangeRateRepository);

  /** TRM vigente para la fecha `YYYY-MM-DD`; hoy en Colombia si se omite. */
  execute(date?: string): Observable<ExchangeRate> {
    return this.repository.trm(date);
  }
}

@Injectable()
export class ListTransactionAccountOptionsUseCase {
  private readonly repository = inject(TransactionAccountOptionsRepository);

  /** Todas las cuentas ordenadas por nombre; el formulario decide cuáles se pueden elegir. */
  execute(): Observable<TransactionAccountOption[]> {
    return this.repository.list().pipe(map(byName));
  }
}

@Injectable()
export class ListTransactionCategoryOptionsUseCase {
  private readonly repository = inject(TransactionCategoryOptionsRepository);

  /** Categorías activas de la clase pedida (o todas), ordenadas por nombre. */
  execute(kind?: CategoryKind): Observable<TransactionCategoryOption[]> {
    return this.repository.list(kind).pipe(map(byName));
  }
}
