import { NextResponse } from 'next/server';
import { healthService } from '@/lib/health';

export async function GET() { return NextResponse.json(healthService.live(), { headers: { 'cache-control': 'no-store' } }); }
