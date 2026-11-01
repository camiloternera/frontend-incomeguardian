import { matchesSearch } from '@shared/text/search-text';

/** Límites que aplica el backend a un tipo de cuenta; el formulario los replica. */
export const ACCOUNT_TYPE_NAME_MAX_LENGTH = 30;
export const ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH = 500;

/** Tipo de cuenta propio del usuario, como Ahorros o Tarjeta de crédito. */
export interface AccountType {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string | null;
}

/** Ordena los tipos de cuenta alfabéticamente, sin distinguir mayúsculas ni tildes. */
export function sortAccountTypes(accountTypes: readonly AccountType[]): AccountType[] {
  return [...accountTypes].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Indica si el tipo de cuenta coincide con la búsqueda por nombre o descripción. */
export function matchesAccountType(accountType: AccountType, query: string): boolean {
  return matchesSearch(query, accountType.name, accountType.description);
}

/** La parte editable de un tipo de cuenta, usada para crearlo y para actualizarlo. */
export interface AccountTypeDraft {
  name: string;
  description: string;
}
