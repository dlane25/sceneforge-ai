import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { requireSeriesAccess } from '@/lib/auth';
import { apiError } from '@/lib/api';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const pipeline = await orchestrationService.getFull((await params).id); await requireSeriesAccess(pipeline.seriesId, 'VIEWER'); return NextResponse.json({ data: await orchestrationService.get(pipeline.id) }); }
  catch (error) { return apiError(error, 'PIPELINE_NOT_FOUND', 'Pipeline not found'); }
}
