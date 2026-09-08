import { z } from 'zod';

export const generationRouteParamsSchema = z.object({
  id: z.string().min(1).max(200),
  episodeId: z.string().min(1).max(200),
  sceneId: z.string().min(1).max(200),
  shotId: z.string().min(1).max(200),
});

export const generationActionParamsSchema = generationRouteParamsSchema.extend({
  jobId: z.string().min(1).max(300),
  action: z.enum(['approve', 'reject', 'start', 'refresh', 'cancel', 'retry']),
});

export const sceneAudioParamsSchema = generationRouteParamsSchema.omit({ shotId: true });
export const sceneAudioActionParamsSchema = sceneAudioParamsSchema.extend({
  jobId: z.string().min(1).max(300),
  action: z.enum(['approve', 'reject', 'start', 'refresh', 'cancel', 'retry', 'asset-approve', 'asset-reject', 'preferred']),
});
export const sceneAudioCreateSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('line'), shotId: z.string().min(1).max(200), characterId: z.string().min(1).max(200).optional() }),
  z.object({ mode: z.literal('scene') }),
]);
export const sceneAudioActionBodySchema = z.object({ assetId: z.string().min(1).max(300).optional(), notes: z.string().trim().max(2000).optional(), rejectionReason: z.string().trim().max(2000).optional() });

export const captionParamsSchema = z.object({ id: z.string().min(1).max(200), episodeId: z.string().min(1).max(200) });
export const captionMutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate'), language: z.string().trim().min(2).max(50), format: z.enum(['srt', 'vtt']) }),
  z.object({ action: z.enum(['approve', 'reject']), trackId: z.string().min(1).max(300), notes: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal('preferred'), trackId: z.string().min(1).max(300) }),
]);
