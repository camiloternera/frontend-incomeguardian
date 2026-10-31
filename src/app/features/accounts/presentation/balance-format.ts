import { Currency } from '../domain/account';

/**
 * `digitsInfo` del `CurrencyPipe` para un saldo: el peso sin centavos cuando el valor es entero,
 * y en cualquier otro caso dos decimales, o tres si los tiene (el backend admite hasta tres).
 */
export function balanceDigits(currency: Currency, amount: number): string {
  return currency === 'COP' && Number.isInteger(amount) ? '1.0-0' : '1.2-3';
}
