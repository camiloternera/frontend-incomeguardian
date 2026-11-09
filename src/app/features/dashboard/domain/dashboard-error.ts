/** Códigos de negocio que envía el backend para el Resumen, escritos tal cual. */
export const DashboardErrorCode = {
  PeriodInvalid: 'PERIOD_INVALID',
} as const;

export type DashboardErrorCode = (typeof DashboardErrorCode)[keyof typeof DashboardErrorCode];

/** Error del Resumen con el mensaje ya traducido y, si se conoce, su código. */
export class DashboardError extends Error {
  constructor(
    message: string,
    readonly code: DashboardErrorCode | null = null,
  ) {
    super(message);
    this.name = 'DashboardError';
  }
}
