/**
 * API pública del dominio de cierre de períodos. Es la excepción documentada en AGENTS.md: el cierre
 * es transversal, así que Resumen, Movimientos y Ajustes lo usan, pero solo a través de este archivo.
 * Nada fuera de `features/periods` importa sus capas internas.
 */
export { providePeriods } from './periods.providers';
export { PeriodErrorCode } from './domain/period-error';
export { PeriodSelectorComponent } from './presentation/components/period-selector/period-selector.component';
export { PeriodBannerComponent } from './presentation/components/period-banner/period-banner.component';
export { PeriodOverlaysComponent } from './presentation/components/period-overlays/period-overlays.component';
export { ClosedMonthBadgeComponent } from './presentation/components/closed-month-badge/closed-month-badge.component';
export {
  LockedDateNoteComponent,
  type LockedDateKind,
} from './presentation/components/locked-date-note/locked-date-note.component';
export { ReopenPeriodButtonComponent } from './presentation/components/reopen-period-button/reopen-period-button.component';
export { injectPeriodChanges } from './presentation/period-changes';
export { PeriodSettingsComponent } from './presentation/components/period-settings/period-settings.component';
