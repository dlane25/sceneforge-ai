import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { orchestrateRequestSchema } from '@/lib/validation/agent-schemas';
import { requireSeriesAccess } from '@/lib/auth';
import { apiError } from '@/lib/api';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: seriesId } = await params;
    const { user } = await requireSeriesAccess(seriesId, 'EDITOR');
    const body: unknown = await request.json().catch(() => ({}));
    const parsed = orchestrateRequestSchema.parse(body);
    const result = await orchestrationService.run(parsed.episodeId, seriesId, user.id);
    return NextResponse.json({ data: result });
  } catch (error) { return apiError(error, 'ORCHESTRATION_FAILED', 'Unable to orchestrate series'); }
}
