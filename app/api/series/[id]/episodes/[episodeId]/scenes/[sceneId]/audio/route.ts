import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { audioGenerationService } from '@/lib/media';
import { sceneAudioCreateSchema, sceneAudioParamsSchema } from '@/lib/media/api-schemas';

type Context = { params: Promise<{ id: string; episodeId: string; sceneId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try { const { user } = await requireUser(); const p = sceneAudioParamsSchema.parse(await params); return NextResponse.json({ data: await audioGenerationService.listScene(user, p.id, p.episodeId, p.sceneId) }); }
  catch (error) { return apiError(error, 'AUDIO_LIST_FAILED', 'Unable to load scene audio'); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { user } = await requireUser();
    const p = sceneAudioParamsSchema.parse(await params);
    const input = sceneAudioCreateSchema.parse(await request.json());
    const data = input.mode === 'scene'
      ? await audioGenerationService.prepareScene(user, p.id, p.episodeId, p.sceneId)
      : await audioGenerationService.prepareLine(user, p.id, p.episodeId, p.sceneId, input.shotId, input.characterId);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return apiError(error, 'AUDIO_PREPARE_FAILED', 'Unable to prepare scene audio'); }
}
