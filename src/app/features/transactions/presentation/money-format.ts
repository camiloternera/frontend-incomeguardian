import { getCurrencySymbol } from '@angular/common';
import { formatMoney as formatSharedMoney } from '@shared/money/money-format';

/** Símbolo de la moneda tal como lo muestra el `CurrencyPipe` con `'symbol'` (por ejemplo `US$` en es-CO). */
export function currencySymbol(currency: string, locale: string): string {
  return getCurrencySymbol(currency, 'wide', locale);
}

/**
 * Formatea un monto igual que `amount | money: currency : moneyDigits(...) : locale`.
 * Se usa para los parámetros de las traducciones, donde no hay pipe.
 */
export function formatMoney(amount: number, currency: string, locale: string): string {
  return formatSharedMoney(amount, currency, locale);
}
