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

/** Tipos de cuenta: una cuenta normal (banco, billetera, efectivo) o una tarjeta de crédito. */
export const ACCOUNT_KINDS = ['standard', 'credit_card'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

/** Indica si el valor recibido es un tipo de cuenta conocido. */
export function isAccountKind(value: unknown): value is AccountKind {
  return typeof value === 'string' && (ACCOUNT_KINDS as readonly string[]).includes(value);
}

/** Días del mes que admite el backend para el corte y el pago de una tarjeta. */
export const CARD_DAY_MIN = 1;
export const CARD_DAY_MAX = 31;

/** Cuenta del usuario, como una cuenta de ahorros o una tarjeta. */
export interface Account {
  id: number;
  name: string;
  kind: AccountKind;
  /**
   * Saldo con el que empezó la cuenta. En una tarjeta es la deuda inicial y es negativo (o 0):
   * la vista la muestra en positivo.
   */
  initialBalance: number;
  /** Saldo inicial más el neto de los movimientos. */
  currentBalance: number;
  currency: Currency;
  /** Las cuentas desactivadas se pueden consultar, pero no editar ni usar en movimientos nuevos. */
  isActive: boolean;
  /** Con movimientos (incluso eliminados) ya no se puede cambiar el nombre ni la moneda. */
  hasTransactions: boolean;
  /** Fecha y hora en que el usuario abrió la cuenta, en ISO 8601 UTC. */
  openingDate: string;
  /** Cupo total de la tarjeta; null si no lo registró o si es una cuenta normal. */
  creditLimit: number | null;
  /** Día de corte y día de pago de la tarjeta (1–31); null en una cuenta normal. */
  statementDay: number | null;
  paymentDay: number | null;
  /** Cupo más saldo: lo que queda para comprar. Negativo si se pasó del cupo; null sin cupo. */
  availableCredit: number | null;
  /** Próximo corte y fecha límite de pago (`YYYY-MM-DD`); null en una cuenta normal. */
  nextStatementDate: string | null;
  nextPaymentDueDate: string | null;
  /** Auditoría del servidor, distinta de la fecha de apertura. */
  createdAt: string;
  updatedAt: string | null;
}

/** Indica si la cuenta es una tarjeta de crédito. */
export function isCreditCard(account: Pick<Account, 'kind'>): boolean {
  return account.kind === 'credit_card';
}

/** Lo que se debe en la tarjeta, en positivo; 0 si tiene saldo a favor. */
export function cardDebt(account: Pick<Account, 'currentBalance'>): number {
  return account.currentBalance < 0 ? -account.currentBalance : 0;
}

/** Porción del cupo usada, de 0 a 1 (tope 1 si se pasó); null si la tarjeta no tiene cupo. */
export function creditUsage(account: Pick<Account, 'creditLimit' | 'currentBalance'>): number | null {
  if (account.creditLimit === null || account.creditLimit <= 0) {
    return null;
  }

  return Math.min(1, cardDebt(account) / account.creditLimit);
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
  kind: AccountKind;
  /** En una tarjeta es la deuda, negativa o 0. */
  initialBalance: number;
  currency: Currency;
  /** Fecha y hora de apertura en ISO 8601 con desfase; no puede ser futura. */
  openingDate: string;
  /** Solo para tarjetas; null en una cuenta normal o si la tarjeta no tiene cupo. */
  creditLimit: number | null;
  statementDay: number | null;
  paymentDay: number | null;
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

/** Lo que se tiene y lo que se debe en una moneda, sin convertir entre monedas. */
export interface CurrencyPosition {
  currency: Currency;
  /** Suma de los saldos de las cuentas normales activas. */
  assets: number;
  /** Deuda de las tarjetas activas, en positivo. Los saldos a favor de una tarjeta suman a `assets`. */
  debt: number;
  /** assets − debt. */
  net: number;
}

/**
 * Posición por moneda de las cuentas activas, en el orden de `CURRENCIES`: lo que hay en las cuentas,
 * lo que se debe en las tarjetas y el neto. Una moneda sin cuentas activas no aparece.
 */
export function positionsByCurrency(accounts: readonly Account[]): CurrencyPosition[] {
  return CURRENCIES.flatMap((currency) => {
    const inCurrency = accounts.filter((account) => account.isActive && account.currency === currency);

    if (!inCurrency.length) {
      return [];
    }

    // En milésimas (el backend guarda 3 decimales) para no arrastrar errores de coma flotante.
    let assets = 0;
    let debt = 0;

    for (const account of inCurrency) {
      const balance = Math.round(account.currentBalance * 1000);

      if (isCreditCard(account) && balance < 0) {
        debt -= balance;
      } else {
        assets += balance;
      }
    }

    return [{ currency, assets: assets / 1000, debt: debt / 1000, net: (assets - debt) / 1000 }];
  });
}
