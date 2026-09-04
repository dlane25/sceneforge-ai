import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { approvalRequestSchema } from '@/lib/validation/agent-schemas';
import { requireSeriesAccess } from '@/lib/auth';
import { apiError } from '@/lib/api';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const pipeline = await orchestrationService.getFull((await params).id); const { user } = await requireSeriesAccess(pipeline.seriesId, 'OWNER'); const parsed = approvalRequestSchema.parse(await request.json().catch(() => ({}))); const result = await orchestrationService.approve(pipeline.id, parsed.note); const queued = await orchestrationService.queueGeneration(result.id); return NextResponse.json({ data: queued, approvedBy: user.id }); }
  catch (error) { return apiError(error, 'APPROVAL_FAILED', 'Approval failed'); }
}
