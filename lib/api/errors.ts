import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthenticationError, AuthorizationError } from '@/lib/auth';

export function apiError(error: unknown, fallbackCode = 'REQUEST_FAILED', fallbackMessage = 'Request could not be completed'): NextResponse {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) } }, { status: 422 });
  if (error instanceof Error && error.message.includes('not found')) return NextResponse.json({ error: { code: 'NOT_FOUND', message: error.message } }, { status: 404 });
  if (error instanceof Error && (error.message.includes('approval') || error.message.includes('state'))) return NextResponse.json({ error: { code: 'INVALID_STATE', message: error.message } }, { status: 409 });
  return NextResponse.json({ error: { code: fallbackCode, message: fallbackMessage } }, { status: 400 });
}
