import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';

export async function GET() { return NextResponse.json({ data: orchestrationService.getExecutions() }); }
