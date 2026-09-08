import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { captionService } from '@/lib/media';
import { captionMutationSchema, captionParamsSchema } from '@/lib/media/api-schemas';

type Context = { params: Promise<{ id: string; episodeId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const { user } = await requireUser(); const p = captionParamsSchema.parse(await params);
    const url = new URL(request.url); const trackId = url.searchParams.get('trackId'); const download = url.searchParams.get('download') === '1';
    if (trackId && download) {
      const safeTrackId = z.string().min(1).max(300).parse(trackId); const track = await captionService.export(user, p.id, p.episodeId, safeTrackId);
      const safeEpisodeId = p.episodeId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeLanguage = track.language.replace(/[^a-zA-Z0-9_-]/g, '_');
      return new NextResponse(track.content, { headers: { 'content-type': track.format === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8', 'content-disposition': `attachment; filename="episode-${safeEpisodeId}-${safeLanguage}.${track.format}"` } });
    }
    return NextResponse.json({ data: await captionService.list(user, p.id, p.episodeId) });
  } catch (error) { return apiError(error, 'CAPTIONS_LIST_FAILED', 'Unable to load captions'); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { user } = await requireUser(); const p = captionParamsSchema.parse(await params); const input = captionMutationSchema.parse(await request.json());
    if (input.action === 'generate') return NextResponse.json({ data: await captionService.generateEpisode(user, p.id, p.episodeId, input) }, { status: 201 });
    if (input.action === 'preferred') return NextResponse.json({ data: await captionService.setPreferred(user, p.id, p.episodeId, input.trackId) });
    return NextResponse.json({ data: await captionService.review(user, p.id, p.episodeId, input.trackId, input.action === 'approve' ? 'approved' : 'rejected', input.notes) });
  } catch (error) { return apiError(error, 'CAPTION_ACTION_FAILED', 'Unable to update captions'); }
}
