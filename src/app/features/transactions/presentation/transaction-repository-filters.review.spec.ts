import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TransactionQuery } from '../domain/transaction';
import { FakeTransactionRepository, transaction } from './transaction-repository.fake';

describe('Transaction repository fake filter contract review', () => {
  async function list(filters: Partial<TransactionQuery>) {
    const repository = new FakeTransactionRepository();
    repository.transactions = [
      transaction(1, 'expense', 10, {
        description: 'Mercado',
        categoryId: 1,
        fromAccountId: 2,
      }),
      transaction(2, 'income', 20, {
        description: 'Salario',
        categoryId: 2,
        toAccountId: 2,
      }),
      transaction(3, 'transfer', 30, {
        description: null,
        categoryId: null,
        fromAccountId: 3,
        toAccountId: 8,
      }),
    ];
    return firstValueFrom(repository.list({ page: 1, pageSize: 10, ...filters }));
  }

  it('filters descriptions and excludes null descriptions', async () => {
    const page = await list({ search: 'Mercado' });
    expect({ ids: page.items.map((item) => item.id), total: page.totalItems }).toEqual({
      ids: [1],
      total: 1,
    });
  });

  it('filters by category', async () => {
    const page = await list({ categoryId: 2 });
    expect({ ids: page.items.map((item) => item.id), total: page.totalItems }).toEqual({
      ids: [2],
      total: 1,
    });
  });

  it('matches an account as either source or destination', async () => {
    const page = await list({ accountId: 2 });
    expect({ ids: page.items.map((item) => item.id), total: page.totalItems }).toEqual({
      ids: [1, 2],
      total: 2,
    });
  });

  it('returns no matches for an unknown account', async () => {
    const page = await list({ accountId: 999 });
    expect({ items: page.items, total: page.totalItems }).toEqual({ items: [], total: 0 });
  });

  it('combines filters before pagination and counts only matching rows', async () => {
    const page = await list({ search: 'Mercado', categoryId: 1, accountId: 2, page: 2, pageSize: 1 });
    expect({ items: page.items, total: page.totalItems }).toEqual({ items: [], total: 1 });
  });

  it('requires all filters to match the same transaction', async () => {
    const page = await list({ search: 'Mercado', categoryId: 2, accountId: 2 });
    expect({ items: page.items, total: page.totalItems }).toEqual({ items: [], total: 0 });
  });

  it('trims search text and ignores case', async () => {
    const page = await list({ search: '  mErCaDo  ' });
    expect({ ids: page.items.map((item) => item.id), total: page.totalItems }).toEqual({
      ids: [1],
      total: 1,
    });
  });
});
