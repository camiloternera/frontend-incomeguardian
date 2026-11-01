/** Pasa a minúsculas y quita las tildes, para que «credito» encuentre «Crédito». */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Indica si alguno de los textos contiene la búsqueda, sin distinguir mayúsculas ni tildes. */
export function matchesSearch(query: string, ...texts: string[]): boolean {
  const needle = normalizeSearchText(query.trim());

  return !needle || texts.some((text) => normalizeSearchText(text).includes(needle));
}
