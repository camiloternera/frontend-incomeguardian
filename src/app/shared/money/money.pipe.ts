import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from './money-format';

/**
 * Monto con el símbolo de su moneda: `amount | money: currency : digitsInfo : locale`. Reemplaza al
 * `CurrencyPipe` con `'symbol'` para que un código sin símbolo (`COP` en en-US) no quede pegado al número.
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: number | null | undefined, currency: string, digits: string | undefined, locale: string): string | null {
    return amount == null ? null : formatMoney(amount, currency, locale, digits);
  }
}
