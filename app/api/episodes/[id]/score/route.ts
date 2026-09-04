import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { requireSeriesAccess } from '@/lib/auth';
import { apiError } from '@/lib/api';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const { user } = await requireSeriesAccess('series_empire_of_lies', 'EDITOR'); const result = await orchestrationService.run(id, 'series_empire_of_lies', user.id); return NextResponse.json({ data: result.scoring, pipeline: result.id, state: result.state }); }
  catch (error) { return apiError(error, 'SCORING_FAILED', 'Unable to score episode'); }
}
