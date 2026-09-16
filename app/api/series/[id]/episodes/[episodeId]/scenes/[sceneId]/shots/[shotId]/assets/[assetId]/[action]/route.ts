import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { mediaReviewService } from '@/lib/media';
import { mediaPreviewService } from '@/lib/media/preview-runtime';

const reviewSchema = z.object({ notes: z.string().max(2000).optional(), rejectionReason: z.string().min(1).max(2000).optional(), compareWith: z.string().optional() });
type Context = { params: Promise<{ id: string; episodeId: string; sceneId: string; shotId: string; assetId: string; action: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { user } = await requireUser();
    const p = await params;
    const ids = [p.id, p.episodeId, p.sceneId, p.shotId];
    const body = reviewSchema.parse(await request.json().catch(() => ({})));
    if (p.action === 'approve') return NextResponse.json({ data: await mediaReviewService.submitReview(user, ids, p.assetId, 'approved', body) });
    if (p.action === 'reject') return NextResponse.json({ data: await mediaReviewService.submitReview(user, ids, p.assetId, 'rejected', body) });
    if (p.action === 'preferred') return NextResponse.json({ data: await mediaReviewService.selectPreferredAsset(user, ids, p.assetId) });
    if (p.action === 'compare' && body.compareWith) return NextResponse.json({ data: await mediaReviewService.compareAssets(user, ids, p.assetId, body.compareWith) });
    return NextResponse.json({ error: { code: 'INVALID_ACTION', message: 'Unsupported asset action' } }, { status: 400 });
  } catch (error) {
    return apiError(error, 'ASSET_ACTION_FAILED', 'Unable to update asset review', request);
  }
}

export async function GET(request: Request, { params }: Context) {
  let action: string | undefined;
  try {
    const p = await params;
    action = p.action;
    const { user } = await requireUser();
    if (action === 'preview') {
      const preview = await mediaPreviewService.createPreview(user, [p.id, p.episodeId, p.sceneId, p.shotId], p.assetId);
      return NextResponse.redirect(preview.url, {
        status: 307,
        headers: { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' },
      });
    }
    if (action !== 'reviews') return NextResponse.json({ error: { code: 'INVALID_ACTION', message: 'Unsupported asset action' } }, { status: 400 });
    return NextResponse.json({ data: await mediaReviewService.getReviewHistory(user, [p.id, p.episodeId, p.sceneId, p.shotId], p.assetId) });
  } catch (error) {
    return action === 'preview'
      ? apiError(error, 'MEDIA_ACCESS_FAILED', 'Unable to open generated media', request)
      : apiError(error, 'REVIEWS_LIST_FAILED', 'Unable to load review history', request);
  }
}
