import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { audioGenerationService, mediaReviewService } from '@/lib/media';
import { productionService } from '@/lib/series';
import { sceneAudioActionBodySchema, sceneAudioActionParamsSchema } from '@/lib/media/api-schemas';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string; jobId: string; action: string }> }) {
  try {
    const { user } = await requireUser();
    const p = sceneAudioActionParamsSchema.parse(await params);
    const body = sceneAudioActionBodySchema.parse(await request.json().catch(() => ({})));
    const ids = [p.id, p.episodeId, p.sceneId];
    const jobActions = {
      approve: () => audioGenerationService.approve(user, ids, p.jobId), reject: () => audioGenerationService.reject(user, ids, p.jobId),
      start: () => audioGenerationService.start(user, ids, p.jobId), refresh: () => audioGenerationService.refresh(user, ids, p.jobId),
      cancel: () => audioGenerationService.cancel(user, ids, p.jobId), retry: () => audioGenerationService.retry(user, ids, p.jobId),
    };
    if (p.action in jobActions) return NextResponse.json({ data: await jobActions[p.action as keyof typeof jobActions]() });
    await productionService.authorizeMediaOperation(user, p.id, 'OWNER');
    const state = await audioGenerationService.listScene(user, p.id, p.episodeId, p.sceneId);
    const job = state.jobs.find((candidate) => candidate.id === p.jobId);
    if (!job) throw new Error(`Audio generation job ${p.jobId} was not found`);
    if (!body.assetId || !job.outputAssetIds.includes(body.assetId)) throw new Error('Audio asset does not belong to this generation job');
    const shotIds = [p.id, p.episodeId, p.sceneId, job.shotId];
    if (p.action === 'asset-approve') return NextResponse.json({ data: await mediaReviewService.submitReview(user, shotIds, body.assetId, 'approved', { notes: body.notes }) });
    if (p.action === 'asset-reject') return NextResponse.json({ data: await mediaReviewService.submitReview(user, shotIds, body.assetId, 'rejected', { notes: body.notes, rejectionReason: body.rejectionReason || 'Rejected during audio review.' }) });
    return NextResponse.json({ data: await mediaReviewService.selectPreferredAsset(user, shotIds, body.assetId) });
  } catch (error) { return apiError(error, 'AUDIO_ACTION_FAILED', 'Unable to update scene audio'); }
}
