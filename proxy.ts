import { NextResponse, type NextRequest } from 'next/server';
import { validateRequestSafety } from '@/lib/security/request-safety';

function requestId(value: string | null): string { return value && /^[A-Za-z0-9_-]{8,100}$/.test(value) ? value : crypto.randomUUID(); }

export function proxy(request: NextRequest) {
  const id = requestId(request.headers.get('x-request-id'));
  const safety = validateRequestSafety({ method: request.method, origin: request.headers.get('origin'), host: request.headers.get('host'), forwardedHost: request.headers.get('x-forwarded-host'), secFetchSite: request.headers.get('sec-fetch-site'), contentLength: request.headers.get('content-length') });
  if (!safety.allowed) return NextResponse.json({ error: { code: safety.code, message: safety.message, requestId: id } }, { status: safety.status, headers: { 'x-request-id': id, 'cache-control': 'no-store' } });
  const headers = new Headers(request.headers); headers.set('x-request-id', id);
  const response = NextResponse.next({ request: { headers } }); response.headers.set('x-request-id', id); return response;
}

export const config = { matcher: '/api/:path*' };
