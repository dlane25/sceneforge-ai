import { NextResponse } from 'next/server';
import { healthService } from '@/lib/health';

export async function GET() { const result = await healthService.ready(); return NextResponse.json(result, { status: result.status === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } }); }
