import { ProviderErrorCode, type NormalizedProviderError } from './types';

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /([?&](?:key|api_key|access_token)=)[^&\s]+/gi,
  /("?(?:apiKey|accessToken|authorization|client_secret|private_key)"?\s*[:=]\s*)["']?[^,"'\s}]+/gi,
  /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/gi,
];

export function sanitizeProviderMessage(value: unknown): string {
  const original = value instanceof Error ? value.message : String(value || 'Provider operation failed');
  const sanitized = SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, '$1[REDACTED]'), original);
  return sanitized.replace(/[\r\n]+/g, ' ').slice(0, 500) || 'Provider operation failed';
}

export class ProviderOperationError extends Error {
  readonly normalized: NormalizedProviderError;

  constructor(normalized: NormalizedProviderError) {
    super(normalized.message);
    this.name = 'ProviderOperationError';
    this.normalized = normalized;
  }
}

export function providerError(code: ProviderErrorCode, message: string, retryable = false, providerCode?: string): ProviderOperationError {
  return new ProviderOperationError({
    code,
    message: sanitizeProviderMessage(message),
    retryable,
    providerCode: providerCode ? sanitizeProviderMessage(providerCode).slice(0, 100) : undefined,
    timestamp: new Date(),
  });
}

export function normalizeProviderError(error: unknown): NormalizedProviderError {
  if (error instanceof ProviderOperationError) return error.normalized;

  const message = sanitizeProviderMessage(error).toLowerCase();
  let code = ProviderErrorCode.UnknownError;
  let retryable = false;

  if (message.includes('timeout') || message.includes('aborted')) {
    code = ProviderErrorCode.ProviderTimeout;
    retryable = true;
  } else if (message.includes('rate limit') || message.includes('too many requests')) {
    code = ProviderErrorCode.RateLimited;
    retryable = true;
  } else if (message.includes('quota')) {
    code = ProviderErrorCode.QuotaExceeded;
  } else if (message.includes('auth') || message.includes('permission') || message.includes('credential')) {
    code = ProviderErrorCode.AuthenticationError;
  } else if (message.includes('unsupported') || message.includes('does not support')) {
    code = ProviderErrorCode.UnsupportedCapability;
  } else if (message.includes('content') || message.includes('safety') || message.includes('policy')) {
    code = ProviderErrorCode.ContentPolicy;
  } else if (message.includes('invalid') || message.includes('required')) {
    code = ProviderErrorCode.InvalidRequest;
  } else if (message.includes('unavailable') || message.includes('network')) {
    code = ProviderErrorCode.ProviderUnavailable;
    retryable = true;
  } else if (message.includes('cancel')) {
    code = ProviderErrorCode.Cancelled;
  }

  return { code, message: sanitizeProviderMessage(error), retryable, timestamp: new Date() };
}

export function providerHttpError(status: number, body: unknown): ProviderOperationError {
  const record = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
  const nested = typeof record.error === 'object' && record.error ? (record.error as Record<string, unknown>) : record;
  const providerCode = String(nested.status || nested.code || status);
  const rawMessage = String(nested.message || `Provider request failed with HTTP ${status}`);

  if (status === 401 || status === 403) return providerError(ProviderErrorCode.AuthenticationError, 'Provider authentication failed', false, providerCode);
  if (status === 429) {
    const quota = rawMessage.toLowerCase().includes('quota');
    return providerError(quota ? ProviderErrorCode.QuotaExceeded : ProviderErrorCode.RateLimited, quota ? 'Provider quota was exceeded' : 'Provider rate limit was exceeded', !quota, providerCode);
  }
  if (status === 400) {
    const policy = /safety|policy|blocked/i.test(rawMessage);
    return providerError(policy ? ProviderErrorCode.ContentPolicy : ProviderErrorCode.InvalidRequest, policy ? 'Provider content policy rejected the request' : 'Provider rejected the request as invalid', false, providerCode);
  }
  if (status === 408 || status === 504) return providerError(ProviderErrorCode.ProviderTimeout, 'Provider request timed out', true, providerCode);
  if (status >= 500) return providerError(ProviderErrorCode.ProviderUnavailable, 'Provider is temporarily unavailable', true, providerCode);
  return providerError(ProviderErrorCode.UnknownError, `Provider request failed with HTTP ${status}`, false, providerCode);
}
