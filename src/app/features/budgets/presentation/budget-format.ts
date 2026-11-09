import { formatCurrency, formatDate, getCurrencySymbol } from '@angular/common';
import { moneyDigits } from '@shared/money/money-format';
import { BudgetMonth, formatMonthKey } from '../domain/budget';

/** Símbolo de la moneda como lo muestra el `CurrencyPipe` (por ejemplo `US$` en es-CO). */
export function currencySymbol(currency: string, locale: string): string {
  return getCurrencySymbol(currency, 'wide', locale);
}

/** Monto con su moneda: sin decimales en COP salvo que los tenga, con dos en USD. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  return formatCurrency(amount, locale, currencySymbol(currency, locale), currency, moneyDigits(currency, amount));
}

/** Monto sin símbolo para el campo editable: «850.000» / «850,000». */
export function formatAmountInput(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: true }).format(amount);
}

/** Solo la primera letra en mayúscula. */
export function capitalized(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** «noviembre» / «November». */
export function monthName(month: BudgetMonth, locale: string): string {
  return formatDate(`${formatMonthKey(month)}-15T12:00:00Z`, 'LLLL', locale, 'UTC');
}

/** Mes y año dentro de una frase: «noviembre 2026» / «November 2026». */
export function monthInSentence(month: BudgetMonth, locale: string): string {
  return formatDate(`${formatMonthKey(month)}-15T12:00:00Z`, 'LLLL y', locale, 'UTC');
}

/** «Noviembre 2026» / «November 2026». */
export function monthLabel(month: BudgetMonth, locale: string): string {
  return capitalized(formatDate(`${formatMonthKey(month)}-15T12:00:00Z`, 'LLLL y', locale, 'UTC'), locale);
}
