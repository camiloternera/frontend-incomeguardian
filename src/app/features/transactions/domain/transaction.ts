/** Límites que aplica el backend a un movimiento; el formulario los replica. */
export const TRANSACTION_AMOUNT_MAX_DECIMALS = 2;
/** El backend guarda el monto como NUMERIC(18,3): como máximo 15 dígitos enteros. */
export const TRANSACTION_AMOUNT_MAX_INTEGER_DIGITS = 15;
export const TRANSACTION_DESCRIPTION_MAX_LENGTH = 500;
/** Movimientos por página del listado. */
export const TRANSACTION_PAGE_SIZE = 5;
/** Zona horaria en la que el backend decide la TRM y qué fecha es futura. */
export const TRANSACTION_TIME_ZONE = 'America/Bogota';
/** Cuotas que admite el backend en una compra con tarjeta. */
export const INSTALLMENTS_MIN = 1;
export const INSTALLMENTS_MAX = 48;
/** Opciones rápidas del número de cuotas; cualquier otro valor se escribe aparte. */
export const INSTALLMENT_CHOICES = [1, 3, 6, 12, 24] as const;
/** Tasa efectiva anual (%) que admite el backend. */
export const INTEREST_RATE_MIN = 0;
export const INTEREST_RATE_MAX = 200;
/** Código de la categoría de sistema para los pagos de tarjeta (tipo transferencia). */
export const CARD_PAYMENT_CATEGORY_CODE = 'CARD_PAYMENT';

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
  /** Número de cuotas de un gasto con tarjeta; 1 en cualquier otro movimiento. */
  installments: number;
  /** Tasa efectiva anual (%) de la compra a cuotas; null sin interés o fuera de una tarjeta. */
  annualInterestRate: number | null;
  /** Valor de cada cuota; null cuando es una sola. */
  installmentAmount: number | null;
  /** Plan de cuotas; solo llega al consultar un movimiento (`get`), vacío en el listado. */
  schedule: InstallmentScheduleItem[];
  /**
   * Si se puede editar o eliminar. Es `false` cuando su mes (o el de alguna cuota) o su año está
   * cerrado, o cuando la cuenta es de solo lectura (EUR).
   */
  canModify: boolean;
}

/** Una cuota del plan de una compra con tarjeta. */
export interface InstallmentScheduleItem {
  /** Número de la cuota, desde 1. */
  number: number;
  /** Mes de corte en el que se cobra la cuota. */
  year: number;
  month: number;
  /** Fecha de corte de ese mes (`YYYY-MM-DD`). */
  statementDate: string;
  principal: number;
  interest: number;
  amount: number;
}

/** Indica si el movimiento es una compra a varias cuotas. */
export function hasInstallments(transaction: Pick<Transaction, 'installments'>): boolean {
  return transaction.installments > 1;
}

/** Datos para calcular el plan de cuotas de una compra con tarjeta antes de guardarla. */
export interface InstallmentPreviewRequest {
  fromAccountId: number;
  amount: number;
  /** Fecha ISO 8601 en UTC con `Z`. */
  date: string;
  installments: number;
  /** % EA; null sin interés. */
  annualInterestRate: number | null;
  /** Con categoría, el backend calcula cuánto subirán los topes del presupuesto. */
  categoryId: number | null;
}

/** Cuánto sube el tope de una categoría en un mes por las cuotas de la compra. */
export interface BudgetAdjustment {
  year: number;
  month: number;
  categoryId: number;
  currency: string;
  /** Tope del mes hoy; null si el mes no tiene tope. */
  currentAmount: number | null;
  newAmount: number;
}

/** Plan de cuotas calculado por el backend. */
export interface InstallmentPreview {
  installmentAmount: number;
  totalInterest: number;
  totalAmount: number;
  schedule: InstallmentScheduleItem[];
  /** Solo los meses posteriores al de la compra; el mes de la compra no se toca. */
  budgetAdjustments: BudgetAdjustment[];
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
  /** Primer instante incluido, ISO 8601 en UTC. */
  fromDate?: string;
  /** Último instante incluido, ISO 8601 en UTC. */
  toDate?: string;
}

/** Un mes del calendario; `month` va de 1 a 12. */
export interface TransactionMonth {
  year: number;
  month: number;
}

/** Desfase de Colombia respecto a UTC, en horas; no tiene horario de verano. */
const TIME_ZONE_OFFSET_HOURS = -5;

/** Rango de instantes UTC que cubre el mes completo en hora de Colombia; ambos límites incluidos. */
export function monthRange({ year, month }: TransactionMonth): TransactionRange {
  const start = Date.UTC(year, month - 1, 1, -TIME_ZONE_OFFSET_HOURS);
  const next = Date.UTC(year, month, 1, -TIME_ZONE_OFFSET_HOURS);

  return { fromDate: new Date(start).toISOString(), toDate: new Date(next - 1).toISOString() };
}

/** Mes desplazado `delta` meses (negativo hacia atrás). */
export function shiftMonth({ year, month }: TransactionMonth, delta: number): TransactionMonth {
  const index = year * 12 + (month - 1) + delta;

  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Compara dos meses: negativo si `a` es anterior, 0 si son el mismo. */
export function compareMonths(a: TransactionMonth, b: TransactionMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** Mes de un día `YYYY-MM-DD`. */
export function monthOfDay(day: string): TransactionMonth {
  const [year, month] = day.split('-').map(Number);

  return { year, month };
}

/** Lee un mes con la forma `YYYY-MM`; null si no la tiene. */
export function parseMonth(value: string | null): TransactionMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  const month = match ? Number(match[2]) : 0;

  return match && month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

/** El mes como `YYYY-MM`. */
export function formatMonthKey({ year, month }: TransactionMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Día (`YYYY-MM-DD`) en hora de Colombia de un instante ISO. */
export function dayOf(instant: string): string {
  // `en-CA` formatea las fechas como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TRANSACTION_TIME_ZONE }).format(new Date(instant));
}

/** Movimientos consecutivos de un mismo día, en el orden en que llegaron. */
export interface TransactionDay<T> {
  /** Día `YYYY-MM-DD` en hora de Colombia. */
  day: string;
  items: T[];
}

/** Agrupa por día una lista ya ordenada por fecha, sin reordenarla. */
export function groupByDay<T>(items: readonly T[], instantOf: (item: T) => string): TransactionDay<T>[] {
  const groups: TransactionDay<T>[] = [];

  for (const item of items) {
    const day = dayOf(instantOf(item));
    const last = groups.at(-1);

    if (last?.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }

  return groups;
}

/** Lo que se movió en una moneda durante un rango; COP y USD nunca se mezclan. */
export interface CurrencySummary {
  currency: string;
  /** Ingresos en la moneda de su cuenta destino. */
  income: number;
  /** Gastos en la moneda de su cuenta origen. */
  expense: number;
  /** Transferencias recibidas, ya convertidas a esta moneda. */
  transfersIn: number;
  transfersOut: number;
  /** income + transfersIn − expense − transfersOut. */
  net: number;
}

/** Resumen de un rango de fechas, con los mismos filtros que el listado. */
export interface TransactionSummary {
  /** Coincide con el `totalItems` del listado del mismo rango. */
  totalItems: number;
  /** Una entrada por moneda con movimientos; vacía si no hubo ninguno. */
  currencies: CurrencySummary[];
}

/** Rango de instantes UTC, ambos incluidos. */
export interface TransactionRange {
  fromDate: string;
  toDate: string;
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

/** Dinero que sale de una cuenta. Con una tarjeta puede ser a cuotas. */
export interface ExpenseDraft extends TransactionDraftBase {
  type: 'expense';
  fromAccountId: number;
  /** Solo con tarjeta; se omite (1) en cualquier otra cuenta. */
  installments?: number;
  /** % EA; null o ausente sin interés. */
  annualInterestRate?: number | null;
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
  /** Saldo actual; null mientras el backend no lo informe. En una tarjeta es negativo si hay deuda. */
  currentBalance: number | null;
  isActive: boolean;
  /** Si es una tarjeta de crédito: sus gastos pueden ser a cuotas y sus pagos son transferencias. */
  isCreditCard: boolean;
  /** Cupo disponible de la tarjeta; null sin cupo o en una cuenta normal. */
  availableCredit: number | null;
  /** Próximo corte de la tarjeta (`YYYY-MM-DD`); null en una cuenta normal. */
  nextStatementDate: string | null;
}

/** Indica si la cuenta se puede usar en un movimiento nuevo: activa y en una moneda soportada. */
export function isUsableAccount(account: TransactionAccountOption): boolean {
  return account.isActive && isTransactionCurrency(account.currency);
}

/** Categoría que se puede asignar a un movimiento. */
export interface TransactionCategoryOption {
  id: number;
  name: string;
  /** Tipo de movimiento al que pertenece; null si el backend envía uno que la app no conoce. */
  type: TransactionType | null;
  /** Las desactivadas no se ofrecen en movimientos nuevos, pero nombran los ya registrados. */
  isActive: boolean;
  /** Código de una categoría de sistema (por ejemplo `CARD_PAYMENT`); null en las del usuario. */
  code: string | null;
}

/** Indica si la categoría se puede usar en el tipo de movimiento: deben ser del mismo tipo. */
export function categoryAppliesTo(category: TransactionCategoryOption, type: TransactionType): boolean {
  return category.type === type;
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
