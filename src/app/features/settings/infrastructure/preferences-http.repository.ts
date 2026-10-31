import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, OperatorFunction, catchError, map, pipe, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/http/api-response';
import { apiErrorCode, resolveApiError } from '@core/http/api-error';
import { isLanguage } from '@core/i18n/language';
import { isThemeName } from '@core/theme/theme-name';
import { PreferencesError, PreferencesErrorCode, isPreferencesErrorCode } from '../domain/preferences-error';
import { PreferencesRepository } from '../domain/preferences.repository';
import { UserPreferences } from '../domain/user-preferences';
import { PreferencesDto } from './preferences.dto';

/** Cada código conocido del backend para preferencias, asociado a su clave de traducción. */
const PREFERENCES_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(PreferencesErrorCode).map((code) => [code, `settings.errors.${code}`]),
);

/** Valida lo que llega del backend: un valor desconocido no debe romper el tema ni el idioma de la app. */
function toPreferences(dto: PreferencesDto): UserPreferences {
  if (!isThemeName(dto.theme) || !isLanguage(dto.language)) {
    throw dto;
  }

  return { theme: dto.theme, language: dto.language };
}

@Injectable()
export class PreferencesHttpRepository extends PreferencesRepository {
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);
  private readonly url = `${environment.apiUrl}/api/v1/User/preferences`;

  get(): Observable<UserPreferences> {
    return this.http.get<ApiResponse<PreferencesDto>>(this.url).pipe(this.unwrap());
  }

  save(preferences: UserPreferences): Observable<UserPreferences> {
    const body: PreferencesDto = { theme: preferences.theme, language: preferences.language };

    return this.http.put<ApiResponse<PreferencesDto>>(this.url, body).pipe(this.unwrap());
  }

  /** Extrae `data` del sobre, lo valida y convierte cualquier fallo en un `PreferencesError`. */
  private unwrap(): OperatorFunction<ApiResponse<PreferencesDto>, UserPreferences> {
    return pipe(
      map((response) => {
        // Un 2xx es éxito salvo que el sobre diga lo contrario.
        if (!response?.isSuccess || !response.data) {
          throw response;
        }

        return toPreferences(response.data);
      }),
      catchError((error: unknown) => throwError(() => this.toError(error))),
    );
  }

  private toError(error: unknown): PreferencesError {
    const code = apiErrorCode(error);
    const message = resolveApiError(error, PREFERENCES_ERROR_KEYS, (key) => this.transloco.translate(key));

    return new PreferencesError(message, isPreferencesErrorCode(code) ? code : null);
  }
}
