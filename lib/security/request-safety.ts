export const MAX_JSON_BODY_BYTES = 1_048_576;

export interface RequestSafetyResult { allowed: boolean; status?: 403 | 413; code?: 'CROSS_ORIGIN_REQUEST' | 'REQUEST_TOO_LARGE'; message?: string }

export function validateRequestSafety(input: { method: string; origin?: string | null; host?: string | null; forwardedHost?: string | null; secFetchSite?: string | null; contentLength?: string | null; maxBytes?: number }): RequestSafetyResult {
  const length = Number(input.contentLength || 0); const maximum = input.maxBytes || MAX_JSON_BODY_BYTES;
  if (!Number.isNaN(length) && length > maximum) return { allowed: false, status: 413, code: 'REQUEST_TOO_LARGE', message: 'Request body exceeds the allowed size' };
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(input.method.toUpperCase())) return { allowed: true };
  if (input.secFetchSite === 'cross-site') return { allowed: false, status: 403, code: 'CROSS_ORIGIN_REQUEST', message: 'Cross-origin state changes are not permitted' };
  if (input.origin) {
    try {
      const originHost = new URL(input.origin).host.toLowerCase(); const requestHost = (input.forwardedHost || input.host || '').split(',')[0].trim().toLowerCase();
      if (!requestHost || originHost !== requestHost) return { allowed: false, status: 403, code: 'CROSS_ORIGIN_REQUEST', message: 'Cross-origin state changes are not permitted' };
    } catch { return { allowed: false, status: 403, code: 'CROSS_ORIGIN_REQUEST', message: 'Request origin is invalid' }; }
  }
  return { allowed: true };
}
