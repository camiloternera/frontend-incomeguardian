/**
 * `digitsInfo` del `CurrencyPipe` para un monto: el peso sin centavos cuando el valor es entero,
 * y en cualquier otro caso dos decimales, o tres si los tiene (el backend admite hasta tres).
 */
export function moneyDigits(currency: string, amount: number): string {
  return currency === 'COP' && Number.isInteger(amount) ? '1.0-0' : '1.2-3';
}
