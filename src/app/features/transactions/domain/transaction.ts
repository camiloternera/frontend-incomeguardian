/** Límites que aplica el backend a un movimiento; el formulario los replica. */
export const TRANSACTION_AMOUNT_MAX_DECIMALS = 2;
/** El backend guarda el monto como NUMERIC(18,3): como máximo 15 dígitos enteros. */
export const TRANSACTION_AMOUNT_MAX_INTEGER_DIGITS = 15;
export const TRANSACTION_DESCRIPTION_MAX_LENGTH = 500;
/** Movimientos por página del listado. */
export const TRANSACTION_PAGE_SIZE = 5;
/** Zona horaria en la que el backend decide la TRM y qué fecha es futura. */
export const TRANSACTION_TIME_ZONE = 'America/Bogota';

/** Clases de movimiento que registra el usuario. */
export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Indica si el valor recibido es un tipo de movimiento conocido. */
export function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === 'string' && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

/** Monedas con las que se pueden registrar movimientos, en código ISO 4217. */
export const TRANSACTION_CURRENCIES = ['COP', 'USD'] as const;
export type TransactionCurrency = (typeof TRANSACTION_CURRENCIES)[number];

/** Indica si la moneda se puede usar en movimientos; las cuentas en otras monedas son de solo lectura. */
export function isTransactionCurrency(value: unknown): value is TransactionCurrency {
  return typeof value === 'string' && (TRANSACTION_CURRENCIES as readonly string[]).includes(value);
}

/** Movimiento registrado, tal como lo devuelve el backend. */
export interface Transaction {
  id: number;
  type: TransactionType;
  /** Monto en la moneda de la cuenta origen (o de la cuenta destino en un ingreso). */
  amount: number;
  /** Fecha ISO 8601 en UTC. */
  date: string;
  fromAccountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  description: string | null;
  fromCurrency: string | null;
  toCurrency: string | null;
  /** Monto que llegó a la cuenta destino; igual a `amount` si las monedas coinciden. */
  destinationAmount: number | null;
  /** TRM usada en una transferencia entre monedas distintas; null en los demás casos. */
  exchangeRate: number | null;
  exchangeRateDate: string | null;
}

/** Una página del listado de movimientos. */
export interface TransactionPage {
  items: Transaction[];
  page: number;
  pageSize: number;
  totalItems: number;
}

/** Filtros del listado de movimientos. */
export interface TransactionQuery {
  page: number;
  pageSize: number;
  type?: TransactionType;
  accountId?: number;
}

/** Campos comunes a cualquier movimiento nuevo. */
interface TransactionDraftBase {
  amount: number;
  /** Fecha ISO 8601 en UTC con `Z`. */
  date: string;
  categoryId: number | null;
  description: string | null;
}

/** Dinero que entra a una cuenta. */
export interface IncomeDraft extends TransactionDraftBase {
  type: 'income';
  toAccountId: number;
}

/** Dinero que sale de una cuenta. */
export interface ExpenseDraft extends TransactionDraftBase {
  type: 'expense';
  fromAccountId: number;
}

/** Dinero que pasa de una cuenta a otra; el backend calcula el monto destino si cambian las monedas. */
export interface TransferDraft extends TransactionDraftBase {
  type: 'transfer';
  fromAccountId: number;
  toAccountId: number;
}

export type TransactionDraft = IncomeDraft | ExpenseDraft | TransferDraft;

/** Cuenta que se puede elegir en un movimiento: solo lo que el formulario necesita. */
export interface TransactionAccountOption {
  id: number;
  name: string;
  currency: string;
  /** Saldo actual; null mientras el backend no lo informe. */
  currentBalance: number | null;
  isActive: boolean;
}

/** Indica si la cuenta se puede usar en un movimiento nuevo: activa y en una moneda soportada. */
export function isUsableAccount(account: TransactionAccountOption): boolean {
  return account.isActive && isTransactionCurrency(account.currency);
}

/** Clase de categoría según el tipo de movimiento al que aplica. */
export type CategoryKind = 'income' | 'expense' | 'both';

/** Categoría que se puede asignar a un movimiento. */
export interface TransactionCategoryOption {
  id: number;
  name: string;
  kind: CategoryKind;
  /** Las desactivadas no se ofrecen en movimientos nuevos, pero nombran los ya registrados. */
  isActive: boolean;
}

/** Indica si la categoría aplica al tipo de movimiento; las transferencias aceptan cualquiera. */
export function categoryAppliesTo(category: TransactionCategoryOption, type: TransactionType): boolean {
  return type === 'transfer' || category.kind === 'both' || category.kind === type;
}

/** TRM oficial: pesos colombianos por un dólar, vigente entre `validFrom` y `validTo`. */
export interface ExchangeRate {
  base: 'USD';
  quote: 'COP';
  rate: number;
  /** Fechas `YYYY-MM-DD` en hora de Colombia. */
  validFrom: string;
  validTo: string;
  source: string;
}

/** Indica si una transferencia entre estas monedas necesita conversión. */
export function isCrossCurrency(from: string, to: string): boolean {
  return from !== to;
}

/**
 * Redondea a 2 decimales alejándose de cero en el punto medio, igual que el backend
 * (`MidpointRounding.AwayFromZero`). Se corrige el error de coma flotante antes de redondear.
 */
export function roundAwayFromZero(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const scaled = Number((Math.abs(value) * factor).toPrecision(15));
  return (Math.sign(value) * Math.round(scaled)) / factor;
}

/**
 * Vista previa del monto que llega en una transferencia. COP→USD divide por la TRM y USD→COP
 * multiplica; con la misma moneda devuelve el mismo monto. El valor que cuenta es el que
 * devuelve el backend al crear la transferencia.
 */
export function previewDestinationAmount(
  amount: number,
  from: TransactionCurrency,
  to: TransactionCurrency,
  rate: number,
): number {
  if (!isCrossCurrency(from, to)) {
    return amount;
  }

  return roundAwayFromZero(from === 'COP' ? amount / rate : amount * rate);
}
