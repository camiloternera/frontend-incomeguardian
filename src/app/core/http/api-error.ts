import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse } from './api-response';

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'isSuccess' in value;
}

/**
 * Reads the error out of the API envelope, which reaches us either inside an
 * HttpErrorResponse or as a 200 body carrying `isSuccess: false`.
 *
 * The backend answers in Spanish. Each feature passes its own map of known codes
 * to English UI copy; anything unmapped falls back to the message the backend sent.
 */
export function resolveApiError(error: unknown, messageByCode: Record<string, string> = {}): string {
  const envelope = error instanceof HttpErrorResponse ? error.error : error;

  if (!isApiResponse(envelope)) {
    return GENERIC_ERROR;
  }

  const first = envelope.errors?.[0];
  const mapped = first?.code ? messageByCode[first.code] : undefined;

  return mapped ?? first?.message ?? envelope.messageKey ?? GENERIC_ERROR;
}
