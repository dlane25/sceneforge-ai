import { z } from 'zod';

export const seriesInputSchema = z.object({
  title: z.string().trim().min(1),
  logline: z.string().trim().min(1),
  genre: z.string().trim().min(1),
  targetAudience: z.string().trim().min(1),
  visualStyle: z.string().trim().min(1),
  episodeCount: z.number().int().positive(),
  episodeDurationSeconds: z.number().int().positive(),
});

export const shotContinuityRequirementSchema = z.object({
  key: z.string().min(1),
  expectedValue: z.string().min(1),
  episodeNumber: z.number().int().positive().optional(),
  sceneNumber: z.number().int().positive().optional(),
});

export const productionInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  logline: z.string().trim().min(1).max(1000),
  genre: z.string().trim().min(1).max(120),
  targetAudience: z.string().trim().min(1).max(200),
  visualStyle: z.string().trim().min(1).max(500),
  episodeCount: z.number().int().min(1).max(1000),
  episodeDurationSeconds: z.number().int().min(1).max(3600),
  status: z.enum(['draft', 'in-development', 'completed', 'archived']).optional(),
});

export const productionPatchSchema = productionInputSchema.partial();

export const memberInputSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});

export const memberRoleSchema = z.object({ role: z.enum(['OWNER', 'EDITOR', 'VIEWER']) });
