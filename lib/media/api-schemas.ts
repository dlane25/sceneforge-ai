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
