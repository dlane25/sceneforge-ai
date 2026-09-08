import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AuthenticationError, AuthorizationError } from '@/lib/auth';
import { RateLimitError } from '@/lib/security/rate-limit';
import { consoleObservabilitySink } from '@/lib/observability';

async function correlationId(request?: Request): Promise<string> { const supplied = request ? request.headers.get('x-request-id') : (await headers()).get('x-request-id'); return supplied && /^[A-Za-z0-9_-]{8,100}$/.test(supplied) ? supplied : randomUUID(); }
function response(status: number, body: object, id: string, extra: HeadersInit = {}): NextResponse { return NextResponse.json(body, { status, headers: { 'x-request-id': id, 'cache-control': 'no-store', ...extra } }); }

export async function apiError(error: unknown, fallbackCode = 'REQUEST_FAILED', fallbackMessage = 'Request could not be completed', request?: Request): Promise<NextResponse> {
  const requestId = await correlationId(request); consoleObservabilitySink.write({ event: error instanceof AuthenticationError ? 'authentication_failure' : 'api_failure', requestId, errorCode: fallbackCode, status: error instanceof Error ? error.name : 'UnknownError' });
  if (error instanceof RateLimitError) return response(429, { error: { code: error.code, message: error.message, requestId, retryAfterSeconds: error.retryAfterSeconds } }, requestId, { 'retry-after': String(error.retryAfterSeconds) });
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) return response(error.status, { error: { code: error.code, message: error.message, requestId } }, requestId);
  if (error instanceof ZodError) return response(422, { error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', requestId, issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) } }, requestId);
  if (error instanceof Error && error.message.includes('not found')) return response(404, { error: { code: 'NOT_FOUND', message: error.message, requestId } }, requestId);
  if (error instanceof Error && (error.message.toLowerCase().includes('approval') || error.message.toLowerCase().includes('state'))) return response(409, { error: { code: 'INVALID_STATE', message: 'The requested operation is not valid in the current state', requestId } }, requestId);
  return response(400, { error: { code: fallbackCode, message: fallbackMessage, requestId } }, requestId);
}
