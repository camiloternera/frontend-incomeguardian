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

/**
 * Monedas en las que se puede crear o editar una cuenta. Las cuentas en otras monedas
 * (EUR) que ya existan quedan de solo lectura.
 */
export const SELECTABLE_CURRENCIES = ['COP', 'USD'] as const satisfies readonly Currency[];
export type SelectableCurrency = (typeof SELECTABLE_CURRENCIES)[number];

/** Indica si la moneda se puede elegir al crear o editar una cuenta. */
export function isSelectableCurrency(value: unknown): value is SelectableCurrency {
  return typeof value === 'string' && (SELECTABLE_CURRENCIES as readonly string[]).includes(value);
}

/** Cuenta del usuario, como una cuenta de ahorros o una tarjeta. */
export interface Account {
  id: number;
  name: string;
  initialBalance: number;
  /** Saldo inicial más el neto de los movimientos. */
  currentBalance: number;
  currency: Currency;
  /** Las cuentas desactivadas se pueden consultar, pero no editar ni usar en movimientos nuevos. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** Ordena las cuentas alfabéticamente, sin distinguir mayúsculas ni tildes. */
export function sortAccounts(accounts: readonly Account[]): Account[] {
  return [...accounts].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

/** Indica si la cuenta coincide con la búsqueda por su nombre o su moneda. */
export function matchesAccount(account: Account, query: string): boolean {
  return matchesSearch(query, account.name, account.currency);
}

/** La parte editable de una cuenta, usada para crearla y para actualizarla. */
export interface AccountDraft {
  name: string;
  initialBalance: number;
  currency: Currency;
}

/** Suma de los saldos de las cuentas activas en una misma moneda. */
export interface CurrencyTotal {
  currency: Currency;
  total: number;
  /** Cuentas activas que aportan a la suma. */
  count: number;
}

/**
 * Totales por moneda de las cuentas activas, en el orden de `CURRENCIES`. Las monedas no se
 * convierten ni se mezclan; una moneda sin cuentas activas no aparece. Se suma el saldo
 * actual de cada cuenta.
 */
export function totalsByCurrency(accounts: readonly Account[]): CurrencyTotal[] {
  return CURRENCIES.flatMap((currency) => {
    const inCurrency = accounts.filter(
      (account) => account.isActive && account.currency === currency,
    );

    if (!inCurrency.length) {
      return [];
    }

    // Se suma en milésimas (el backend guarda 3 decimales) para no arrastrar errores de coma flotante.
    const thousandths = inCurrency.reduce(
      (sum, account) => sum + Math.round(account.currentBalance * 1000),
      0,
    );

    return [{ currency, total: thousandths / 1000, count: inCurrency.length }];
  });
}
