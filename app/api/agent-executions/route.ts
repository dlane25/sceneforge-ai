import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { requireSeriesAccess } from '@/lib/auth';

export async function GET() { const { user } = await requireSeriesAccess('series_empire_of_lies', 'VIEWER'); return NextResponse.json({ data: await orchestrationService.getExecutions(), viewer: user.id }); }
