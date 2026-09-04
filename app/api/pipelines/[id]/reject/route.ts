import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { revisionRequestSchema } from '@/lib/validation/agent-schemas';
import { requireSeriesAccess } from '@/lib/auth';
import { apiError } from '@/lib/api';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const pipeline = await orchestrationService.getFull((await params).id); await requireSeriesAccess(pipeline.seriesId, 'OWNER'); const parsed = revisionRequestSchema.parse(await request.json().catch(() => ({}))); return NextResponse.json({ data: await orchestrationService.reject(pipeline.id, parsed.note) }); }
  catch (error) { return apiError(error, 'REJECTION_FAILED', 'Rejection failed'); }
}
