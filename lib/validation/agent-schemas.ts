import { z } from 'zod';

export const orchestrateRequestSchema = z.object({ episodeId: z.string().min(1).default('ep_1') });
export const approvalRequestSchema = z.object({ note: z.string().max(500).optional() });
export const revisionRequestSchema = z.object({ note: z.string().max(500).optional() });
