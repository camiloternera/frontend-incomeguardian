import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse } from './api-response';

/** Translation key for the copy shown when nothing more specific is known. */
export const GENERIC_ERROR_KEY = 'errors.generic';

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'isSuccess' in value;
}

function readEnvelope(error: unknown): ApiResponse<unknown> | null {
  const envelope = error instanceof HttpErrorResponse ? error.error : error;

  return isApiResponse(envelope) ? envelope : null;
}

/** El código del primer error que reportó el backend, si existe. */
export function apiErrorCode(error: unknown): string | undefined {
  return readEnvelope(error)?.errors?.[0]?.code;
}

/**
 * Reads the error out of the API envelope, which reaches us either inside an
 * HttpErrorResponse or as a 200 body carrying `isSuccess: false`.
 *
 * Each feature passes its own map of known codes to translation keys, plus the
 * function that translates them. Anything unmapped falls back to the message the
 * backend sent, which already comes in the active language via `Accept-Language`.
 */
export function resolveApiError(
  error: unknown,
  keyByCode: Record<string, string>,
  translate: (key: string) => string,
): string {
  const envelope = readEnvelope(error);

  if (!envelope) {
    return translate(GENERIC_ERROR_KEY);
  }

  const first = envelope.errors?.[0];
  const key = first?.code ? keyByCode[first.code] : undefined;

  return (
    (key ? translate(key) : undefined) ??
    first?.message ??
    envelope.message ??
    envelope.messageKey ??
    translate(GENERIC_ERROR_KEY)
  );
}
