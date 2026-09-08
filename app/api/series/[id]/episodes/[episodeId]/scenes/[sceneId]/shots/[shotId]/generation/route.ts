import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { generationService } from '@/lib/media';
import { generationRouteParamsSchema } from '@/lib/media/api-schemas';

type Context = { params: Promise<{ id: string; episodeId: string; sceneId: string; shotId: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const { user } = await requireUser();
    const p = generationRouteParamsSchema.parse(await params);
    return NextResponse.json({ data: await generationService.prepare(user, p.id, p.episodeId, p.sceneId, p.shotId) }, { status: 201 });
  } catch (error) { return apiError(error, 'GENERATION_PREPARE_FAILED', 'Unable to prepare generation'); }
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const { user } = await requireUser();
    const p = generationRouteParamsSchema.parse(await params);
    return NextResponse.json({ data: await generationService.history(user, [p.id, p.episodeId, p.sceneId, p.shotId]) });
  } catch (error) { return apiError(error, 'GENERATION_HISTORY_FAILED', 'Unable to load generation history'); }
}
