import { formatCurrency, getCurrencySymbol } from '@angular/common';

/**
 * `digitsInfo` del `CurrencyPipe` para un monto: el peso sin centavos cuando el valor es entero,
 * y en cualquier otro caso dos decimales, o tres si los tiene (el backend admite hasta tres).
 */
export function moneyDigits(currency: string, amount: number): string {
  return currency === 'COP' && Number.isInteger(amount) ? '1.0-0' : '1.2-3';
}

/**
 * Formatea un monto con el símbolo de su moneda en el idioma activo, como el `CurrencyPipe` con
 * `'symbol'` (`$ 1.000` y `US$ 25,50` en es-CO; `$25.50` en en-US). Cuando el idioma no tiene
 * símbolo para la moneda y usa su código (`COP` en en-US), lo separa del número con un espacio
 * fijo, como hace `Intl`: `COP 1,000` y no `COP1,000`.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale: string,
  digits = moneyDigits(currency, amount),
): string {
  const symbol = getCurrencySymbol(currency, 'wide', locale);

  return separateCode(formatCurrency(amount, locale, symbol, currency, digits), symbol);
}

/** Pone un espacio fijo entre un símbolo de letras (un código ISO) y el número que lo sigue. */
function separateCode(text: string, symbol: string): string {
  if (!/[A-Za-z]$/.test(symbol)) {
    return text;
  }

  const at = text.indexOf(symbol);
  const next = text.charAt(at + symbol.length);

  return at >= 0 && /\d/.test(next) ? `${text.slice(0, at + symbol.length)} ${text.slice(at + symbol.length)}` : text;
}
