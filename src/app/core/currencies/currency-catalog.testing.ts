import { Provider } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CatalogCurrency, CurrencyCatalog } from './currency-catalog';

/** El catálogo que devuelve hoy el backend: COP y USD activas (EUR está inactiva y no sale). */
export const FAKE_CURRENCIES: CatalogCurrency[] = [
  { id: 1, code: 'COP', name: 'Peso colombiano', symbol: '$', decimalPlaces: 2 },
  { id: 2, code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', decimalPlaces: 2 },
];

/**
 * Catálogo en memoria para los tests; `currencies` se puede reemplazar antes de crear el componente.
 * No extiende `CurrencyCatalog` para no exigir `HttpClient` en los specs.
 */
export class FakeCurrencyCatalog implements Pick<CurrencyCatalog, 'list'> {
  currencies: CatalogCurrency[] = [...FAKE_CURRENCIES];

  list(): Observable<CatalogCurrency[]> {
    return of(this.currencies);
  }
}

/** Reemplaza `CurrencyCatalog` por el catálogo falso. Solo lo importan los specs. */
export function provideFakeCurrencyCatalog(): Provider[] {
  return [FakeCurrencyCatalog, { provide: CurrencyCatalog, useExisting: FakeCurrencyCatalog }];
}
