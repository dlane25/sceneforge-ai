import { z } from 'zod';

export const episodeAssemblyParamsSchema = z.object({ id: z.string().min(1).max(200), episodeId: z.string().min(1).max(200) });
export const assemblyIdParamsSchema = episodeAssemblyParamsSchema.extend({ assemblyId: z.string().min(1).max(300) });
export const assemblyActionParamsSchema = assemblyIdParamsSchema.extend({ action: z.enum(['validate', 'approve', 'reject', 'preferred', 'rebuild']) });
export const assemblyBuildSchema = z.object({ rebuiltFromAssemblyId: z.string().min(1).max(300).optional() });
export const assemblyActionBodySchema = z.object({ notes: z.string().trim().min(1).max(2000).optional() });

export const exportJobParamsSchema = episodeAssemblyParamsSchema.extend({ jobId: z.string().min(1).max(300) });
export const exportActionParamsSchema = exportJobParamsSchema.extend({ action: z.enum(['approve', 'reject', 'start', 'refresh', 'retry', 'cancel']) });
export const exportCreateSchema = z.object({ assemblyId: z.string().min(1).max(300), captionMode: z.enum(['none', 'burn-in', 'sidecar-srt', 'sidecar-vtt']).default('none') });
export const exportActionBodySchema = z.object({ notes: z.string().trim().min(1).max(2000).optional() });
