import { z } from 'zod';

export const seriesLaunchParamsSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/) });
export const episodeLaunchParamsSchema = seriesLaunchParamsSchema.extend({ episodeId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/) });
export const launchPackageParamsSchema = episodeLaunchParamsSchema.extend({ packageId: z.string().regex(/^[A-Za-z0-9_-]{1,300}$/) });
export const launchActionParamsSchema = launchPackageParamsSchema.extend({ action: z.enum(['validate', 'approve', 'reject', 'preferred']) });
export const launchDecisionSchema = z.object({ note: z.string().trim().min(3).max(2000).optional() });
export const operationsQuerySchema = z.object({ seriesId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/).optional() });
