import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { map, switchMap } from 'rxjs';

/**
 * Idioma activo, pero solo cuando las traducciones del scope `transactions` ya cargaron; `null` antes.
 *
 * Los nombres que se traducen en código (como las categorías del sistema) deben leer esta señal: si se
 * traducen antes de que llegue el scope, Transloco devuelve la clave y avisa de que falta la traducción.
 */
export function injectTransactionsTranslations(): Signal<string | null> {
  const transloco = inject(TranslocoService);

  return toSignal(
    transloco.langChanges$.pipe(
      switchMap((lang) => transloco.selectTranslation(`transactions/${lang}`).pipe(map(() => lang))),
    ),
    { initialValue: null },
  );
}
