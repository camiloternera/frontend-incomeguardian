import { Provider } from '@angular/core';
import {
  ClosePeriodUseCase,
  GetPendingPeriodUseCase,
  GetPeriodHistoryUseCase,
  GetPeriodSettingsUseCase,
  GetPeriodYearUseCase,
  ReopenPeriodUseCase,
  ReviewPeriodUseCase,
  SavePeriodSettingsUseCase,
} from './application/period-use-cases';
import { PeriodRepository } from './domain/period.repository';
import { PeriodHttpRepository } from './infrastructure/period-http.repository';
import { PeriodWorkspace } from './presentation/period-workspace';

/**
 * Enlaza el puerto de períodos con su adaptador y provee el estado compartido del cierre. El cierre
 * no tiene ruta propia: lo registran las rutas de las vistas que lo usan (Resumen, Movimientos y
 * Ajustes), así cada una tiene su propio `PeriodWorkspace` dentro de su chunk diferido.
 */
export function providePeriods(): Provider[] {
  return [
    { provide: PeriodRepository, useClass: PeriodHttpRepository },
    GetPeriodYearUseCase,
    GetPendingPeriodUseCase,
    ReviewPeriodUseCase,
    ClosePeriodUseCase,
    ReopenPeriodUseCase,
    GetPeriodHistoryUseCase,
    GetPeriodSettingsUseCase,
    SavePeriodSettingsUseCase,
    PeriodWorkspace,
  ];
}
