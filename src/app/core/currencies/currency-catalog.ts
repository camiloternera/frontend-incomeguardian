import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';

/** Una moneda activa del catálogo del backend (`GET /api/v1/currencies`). */
export interface CatalogCurrency {
  /** Lo que se envía al backend al crear o editar una cuenta o un tope. */
  id: number;
  /** Código ISO 4217 (`COP`, `USD`); con él se formatean los montos. */
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

/** Forma exacta en que la envía el backend. */
interface CatalogCurrencyDto {
  id: number;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

/**
 * Catálogo de monedas activas, ordenadas por código. Es igual para todos los usuarios y casi no
 * cambia, así que se pide una vez por sesión de la app; si la petición falla, la siguiente
 * suscripción vuelve a intentarlo.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyCatalog {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/v1/currencies`;
  private cache: Observable<CatalogCurrency[]> | null = null;

  list(): Observable<CatalogCurrency[]> {
    this.cache ??= this.http.get<ApiResponse<CatalogCurrencyDto[]>>(this.url).pipe(
      map((response) => {
        if (!response?.isSuccess || !Array.isArray(response.data)) {
          throw response;
        }

        return response.data.map((dto) => ({
          id: dto.id,
          code: dto.code,
          name: dto.name,
          symbol: dto.symbol,
          decimalPlaces: dto.decimalPlaces,
        }));
      }),
      catchError((error: unknown) => {
        // Un fallo no se guarda: el próximo llamador vuelve a pedir el catálogo.
        this.cache = null;
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.cache;
  }
}
