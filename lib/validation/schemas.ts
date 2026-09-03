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
