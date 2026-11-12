import { apiErrorCode, resolveApiError } from '@core/http/api-error';
import { DashboardError, DashboardErrorCode } from '../domain/dashboard-error';

/** Cada código conocido del backend para el Resumen, asociado a su clave de traducción. */
const DASHBOARD_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(DashboardErrorCode).map((code) => [code, `dashboard.errors.${code}`]),
);

const KNOWN_CODES: readonly string[] = Object.values(DashboardErrorCode);

/** Convierte cualquier fallo de la API del Resumen en un `DashboardError` traducido que conserva su código. */
export function toDashboardError(error: unknown, translate: (key: string) => string): DashboardError {
  const code = apiErrorCode(error);
  const message = resolveApiError(error, DASHBOARD_ERROR_KEYS, translate);

  return new DashboardError(message, code !== undefined && KNOWN_CODES.includes(code) ? (code as DashboardErrorCode) : null);
}
