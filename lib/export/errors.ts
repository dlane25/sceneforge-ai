import type { ExportErrorCode } from '@/types';

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /([?&](?:key|api_key|access_token)=)[^&\s]+/gi,
  /("?(?:apiKey|accessToken|authorization|client_secret|private_key)"?\s*[:=]\s*)["']?[^,"'\s}]+/gi,
];

export interface NormalizedExportError { code: ExportErrorCode; message: string; retryable: boolean }

export class ExportOperationError extends Error {
  constructor(readonly normalized: NormalizedExportError) { super(normalized.message); this.name = 'ExportOperationError'; }
}

export function sanitizeExportMessage(value: unknown): string {
  const original = value instanceof Error ? value.message : String(value || 'Export operation failed');
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, '$1[REDACTED]'), original).replace(/[\r\n]+/g, ' ').slice(0, 400) || 'Export operation failed';
}

export function exportError(code: ExportErrorCode, message: string, retryable = false): ExportOperationError {
  return new ExportOperationError({ code, message: sanitizeExportMessage(message), retryable });
}

export function normalizeExportError(value: unknown): NormalizedExportError {
  if (value instanceof ExportOperationError) return value.normalized;
  const message = sanitizeExportMessage(value);
  const lower = message.toLowerCase();
  if (lower.includes('timeout') || lower.includes('timed out')) return { code: 'timeout', message: 'Export engine timed out', retryable: true };
  if (lower.includes('cancel')) return { code: 'cancelled', message: 'Export was cancelled', retryable: false };
  if (lower.includes('unsafe') || lower.includes('scheme') || lower.includes('path')) return { code: 'unsafe_source', message: 'Export source is not permitted', retryable: false };
  if (lower.includes('missing') || lower.includes('not found')) return { code: 'source_missing', message: 'A required export source is missing', retryable: false };
  if (lower.includes('unsupported')) return { code: 'unsupported', message: 'Export operation is unsupported', retryable: false };
  return { code: 'processing_failed', message: 'Export processing failed', retryable: true };
}
