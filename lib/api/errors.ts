import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthenticationError, AuthorizationError } from '@/lib/auth';
import { RateLimitError } from '@/lib/security/rate-limit';
import { consoleObservabilitySink } from '@/lib/observability';

async function correlationId(request?: Request): Promise<string> { const supplied = request ? request.headers.get('x-request-id') : (await headers()).get('x-request-id'); return supplied && /^[A-Za-z0-9_-]{8,100}$/.test(supplied) ? supplied : randomUUID(); }
function response(status: number, body: object, id: string, extra: HeadersInit = {}): NextResponse { return NextResponse.json(body, { status, headers: { 'x-request-id': id, 'cache-control': 'no-store', ...extra } }); }

const PRISMA_META_KEYS = ['modelName', 'target', 'field_name', 'constraint', 'column'] as const;
const SAFE_PRISMA_META_VALUE = /^[A-Za-z0-9_.() -]{1,160}$/;

function sanitizedPrismaDiagnostics(error: unknown): { prismaCode?: string; prismaMeta?: Record<string, string | string[]> } {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return {};
  const prismaMeta: Record<string, string | string[]> = {};
  for (const key of PRISMA_META_KEYS) {
    const value = error.meta?.[key];
    if (typeof value === 'string' && SAFE_PRISMA_META_VALUE.test(value)) prismaMeta[key] = value;
    if (Array.isArray(value)) {
      const values = value.filter((item): item is string => typeof item === 'string' && SAFE_PRISMA_META_VALUE.test(item)).slice(0, 10);
      if (values.length) prismaMeta[key] = values;
    }
  }
  return {
    prismaCode: /^P\d{4}$/.test(error.code) ? error.code : undefined,
    prismaMeta: Object.keys(prismaMeta).length ? prismaMeta : undefined,
  };
}

export async function apiError(error: unknown, fallbackCode = 'REQUEST_FAILED', fallbackMessage = 'Request could not be completed', request?: Request): Promise<NextResponse> {
  const requestId = await correlationId(request); consoleObservabilitySink.write({ event: error instanceof AuthenticationError ? 'authentication_failure' : 'api_failure', requestId, errorCode: fallbackCode, status: error instanceof Error ? error.name : 'UnknownError', ...sanitizedPrismaDiagnostics(error) });
  if (error instanceof RateLimitError) return response(429, { error: { code: error.code, message: error.message, requestId, retryAfterSeconds: error.retryAfterSeconds } }, requestId, { 'retry-after': String(error.retryAfterSeconds) });
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) return response(error.status, { error: { code: error.code, message: error.message, requestId } }, requestId);
  if (error instanceof ZodError) return response(422, { error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', requestId, issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) } }, requestId);
  if (error instanceof Error && error.message.includes('not found')) return response(404, { error: { code: 'NOT_FOUND', message: error.message, requestId } }, requestId);
  if (error instanceof Error && (error.message.toLowerCase().includes('approval') || error.message.toLowerCase().includes('state'))) return response(409, { error: { code: 'INVALID_STATE', message: 'The requested operation is not valid in the current state', requestId } }, requestId);
  return response(400, { error: { code: fallbackCode, message: fallbackMessage, requestId } }, requestId);
}
