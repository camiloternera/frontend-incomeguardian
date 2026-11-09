/** Parte entera con separadores de miles: grupos de tres cifras separados por un mismo signo. */
const GROUPED = /^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/;

/**
 * Lleva el texto escrito por la persona a la forma `1234.56`, o `null` si no es un número válido.
 * Acepta separadores de miles y decimales en estilo es-CO (`1.234,56`) o en-US (`1,234.56`).
 * Un único separador seguido de exactamente tres cifras se toma como de miles (`400.000`),
 * porque los montos no admiten tres decimales.
 */
export function normalizeAmount(text: string): string | null {
  const value = (text ?? '').trim();

  if (!/^[\d.,]+$/.test(value)) {
    return null;
  }

  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  let decimalAt = -1;

  if (lastDot >= 0 && lastComma >= 0) {
    decimalAt = Math.max(lastDot, lastComma);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ',';
    const at = Math.max(lastDot, lastComma);
    const occurrences = value.split(separator).length - 1;
    const digitsAfter = value.length - at - 1;

    decimalAt = occurrences === 1 && digitsAfter !== 3 ? at : -1;
  }

  const integer = decimalAt >= 0 ? value.slice(0, decimalAt) : value;
  const decimals = decimalAt >= 0 ? value.slice(decimalAt + 1) : '';

  if (decimalAt >= 0 && !/^\d+$/.test(decimals)) {
    return null;
  }

  if (/^\d+$/.test(integer)) {
    return decimals ? `${integer}.${decimals}` : integer;
  }

  const grouped = GROUPED.exec(integer);

  // El separador de miles no puede ser el mismo que el decimal.
  if (!grouped || (decimalAt >= 0 && grouped[1] === value[decimalAt])) {
    return null;
  }

  const digits = integer.replace(/[.,]/g, '');

  return decimals ? `${digits}.${decimals}` : digits;
}

/** Convierte el texto del campo en número; `NaN` si no es válido. */
export function parseAmount(text: string): number {
  const normalized = normalizeAmount(text);

  return normalized === null ? NaN : Number(normalized);
}
