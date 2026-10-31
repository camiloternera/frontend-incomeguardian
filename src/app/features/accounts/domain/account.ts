import { matchesSearch } from '@shared/text/search-text';

/** Límites que aplica el backend a una cuenta; el formulario los replica. */
export const ACCOUNT_NAME_MAX_LENGTH = 50;
/** El backend guarda el saldo como NUMERIC(18,3). */
export const ACCOUNT_BALANCE_MAX_DECIMALS = 3;
export const ACCOUNT_BALANCE_MAX_INTEGER_DIGITS = 15;

/** Monedas que acepta el backend, en código ISO 4217. */
export const CURRENCIES = ['COP', 'USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Indica si el valor recibido es una de las monedas que conoce la app. */
export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

/** Tipo de cuenta tal como lo ve el dominio de cuentas: solo lo necesario para elegirlo y mostrarlo. */
export interface AccountTypeOption {
  id: number;
  name: string;
}

/** Cuenta del usuario, como una cuenta de ahorros o una tarjeta. */
export interface Account {
  id: number;
  name: string;
  accountType: AccountTypeOption;
  initialBalance: number;
  currency: Currency;
  /** Las cuentas desactivadas se pueden consultar, pero no editar ni usar en movimientos nuevos. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** Ordena las cuentas alfabéticamente, sin distinguir mayúsculas ni tildes. */
export function sortAccounts(accounts: readonly Account[]): Account[] {
  return [...accounts].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Indica si la cuenta coincide con la búsqueda por su nombre o el de su tipo. */
export function matchesAccount(account: Account, query: string): boolean {
  return matchesSearch(query, account.name, account.accountType.name);
}

/** La parte editable de una cuenta, usada para crearla y para actualizarla. */
export interface AccountDraft {
  name: string;
  accountTypeId: number;
  initialBalance: number;
  currency: Currency;
}
