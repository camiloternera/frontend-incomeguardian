import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PeriodRef } from '../domain/period';
import { PeriodWorkspace } from './period-workspace';

/**
 * Cambios de estado de los períodos (cierres y reaperturas), para que otra vista recargue lo que
 * depende de ellos. Se llama en un contexto de inyección, dentro de una ruta con `providePeriods()`.
 */
export function injectPeriodChanges(): Observable<PeriodRef> {
  return inject(PeriodWorkspace).changed$;
}
