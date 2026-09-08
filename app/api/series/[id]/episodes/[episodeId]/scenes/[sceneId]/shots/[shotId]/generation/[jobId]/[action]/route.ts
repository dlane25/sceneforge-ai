import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { generationService } from '@/lib/media';
import { generationActionParamsSchema } from '@/lib/media/api-schemas';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string; shotId: string; jobId: string; action: string }> }) {
  try {
    const { user } = await requireUser();
    const p = generationActionParamsSchema.parse(await params);
    const ids = [p.id, p.episodeId, p.sceneId, p.shotId];
    const actions = {
      approve: () => generationService.approve(user, ids, p.jobId),
      reject: () => generationService.reject(user, ids, p.jobId),
      start: () => generationService.start(user, ids, p.jobId),
      refresh: () => generationService.refresh(user, ids, p.jobId),
      cancel: () => generationService.cancel(user, ids, p.jobId),
      retry: () => generationService.retry(user, ids, p.jobId),
    };
    return NextResponse.json({ data: await actions[p.action]() });
  } catch (error) { return apiError(error, 'GENERATION_ACTION_FAILED', 'Unable to update generation'); }
}
