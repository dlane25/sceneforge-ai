import { readFileSync } from 'node:fs';
import { GenerationJobStatus as PrismaGenerationJobStatus, type GenerationJob as PrismaGenerationJobRecord, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  DOMAIN_TO_PRISMA_GENERATION_STATUS,
  PRISMA_TO_DOMAIN_GENERATION_STATUS,
  type PrismaGenerationStatus,
  fromPrismaGenerationStatus,
  toPrismaGenerationJobCreate,
  toPrismaGenerationStatus,
} from '@/lib/repositories/generation-job-mapper';
import { PrismaPersistenceRepository } from '@/lib/repositories/prisma';
import type { GenerationJob, GenerationJobStatus } from '@/types';

const lifecycleCases = [
  ['draft', PrismaGenerationJobStatus.DRAFT],
  ['awaiting_approval', PrismaGenerationJobStatus.AWAITING_APPROVAL],
  ['approved', PrismaGenerationJobStatus.APPROVED],
  ['queued', PrismaGenerationJobStatus.QUEUED],
  ['processing', PrismaGenerationJobStatus.RUNNING],
  ['completed', PrismaGenerationJobStatus.SUCCEEDED],
  ['failed', PrismaGenerationJobStatus.FAILED],
  ['cancelled', PrismaGenerationJobStatus.CANCELLED],
  ['rejected', PrismaGenerationJobStatus.REJECTED],
] as const;

const now = new Date('2026-09-14T18:00:00.000Z');

function domainJob(status: GenerationJobStatus = 'awaiting_approval'): GenerationJob {
  return {
    id: 'generation_shot_1_1', seriesId: 'series_1', episodeId: 'episode_1', sceneId: 'scene_1', shotId: 'shot_1',
    provider: 'mock', providerModel: 'mock-v1', generationType: 'video', status, promptVersion: '1.0', inputHash: 'input-hash',
    promptSnapshot: 'A safe prompt snapshot', generationParameters: { width: 720, nested: { enabled: true } }, durationSeconds: 4,
    aspectRatio: '9:16', estimatedCost: 0.04, actualCost: 0, retryCount: 0, outputAssetIds: [], createdAt: now, updatedAt: now,
  };
}

function prismaRecord(status: PrismaGenerationStatus = PrismaGenerationJobStatus.AWAITING_APPROVAL): PrismaGenerationJobRecord {
  return {
    id: 'generation_shot_1_1', pipelineId: null, seriesId: 'series_1', episodeId: 'episode_1', provider: 'mock', providerModel: 'mock-v1',
    providerVoiceId: null, characterId: null, language: null, locale: null, model: 'mock-v1', status, promptVersion: '1.0', inputHash: 'input-hash',
    estimatedCost: 0.04, actualCost: 0, retryCount: 0, sceneId: 'scene_1', shotId: 'shot_1', providerJobId: null, generationType: 'video',
    promptSnapshot: 'A safe prompt snapshot', negativePromptSnapshot: null, generationParameters: { width: 720, nested: { enabled: true } },
    durationSeconds: 4, aspectRatio: '9:16', errorCode: null, retryable: null, cancelledAt: null, outputAssetIds: [], errorMessage: null,
    lastProviderStatus: null, lastPolledAt: null, lastProviderError: null, providerMetadata: null, completionMetadata: null,
    createdAt: now, startedAt: null, submittedAt: null, completedAt: null, failedAt: null, updatedAt: now,
  };
}

function repositoryWith(delegate: Record<string, unknown>): PrismaPersistenceRepository {
  return new PrismaPersistenceRepository({ generationJob: delegate } as unknown as PrismaClient);
}

describe('GenerationJob Prisma lifecycle mapping', () => {
  it.each(lifecycleCases)('maps domain %s to Prisma %s', (domain, prisma) => {
    expect(toPrismaGenerationStatus(domain)).toBe(prisma);
  });

  it.each(lifecycleCases)('maps Prisma %s back to domain', (domain, prisma) => {
    expect(fromPrismaGenerationStatus(prisma)).toBe(domain);
  });

  it('is exhaustive, one-to-one, and round-trips every lifecycle status', () => {
    expect(Object.keys(DOMAIN_TO_PRISMA_GENERATION_STATUS)).toHaveLength(9);
    expect(Object.keys(PRISMA_TO_DOMAIN_GENERATION_STATUS)).toHaveLength(9);
    expect(new Set(Object.values(DOMAIN_TO_PRISMA_GENERATION_STATUS)).size).toBe(9);
    for (const [domain, prisma] of lifecycleCases) {
      expect(fromPrismaGenerationStatus(toPrismaGenerationStatus(domain))).toBe(domain);
      expect(toPrismaGenerationStatus(fromPrismaGenerationStatus(prisma))).toBe(prisma);
    }
    expect(() => Reflect.apply(toPrismaGenerationStatus, null, ['unsupported'])).toThrow('Unsupported domain generation status');
    expect(() => Reflect.apply(fromPrismaGenerationStatus, null, ['UNSUPPORTED'])).toThrow('Unsupported Prisma generation status');
  });

  it('maps the complete create payload and preserves the required model field', () => {
    expect(toPrismaGenerationJobCreate(domainJob())).toMatchObject({
      id: 'generation_shot_1_1', episodeId: 'episode_1', sceneId: 'scene_1', shotId: 'shot_1', model: 'mock-v1',
      status: PrismaGenerationJobStatus.AWAITING_APPROVAL, generationType: 'video', generationParameters: { width: 720, nested: { enabled: true } },
    });
    expect(toPrismaGenerationJobCreate({ ...domainJob(), providerModel: undefined }).model).toBe('default');
  });

  it('creates awaiting approval through Prisma and maps the returned record', async () => {
    const create = vi.fn().mockResolvedValue(prismaRecord());
    const repository = repositoryWith({ create });
    const result = await repository.createGenerationJob(domainJob());
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: PrismaGenerationJobStatus.AWAITING_APPROVAL, model: 'mock-v1' }) });
    expect(result.status).toBe('awaiting_approval');
  });

  it.each([
    ['approved', PrismaGenerationJobStatus.APPROVED],
    ['processing', PrismaGenerationJobStatus.RUNNING],
    ['completed', PrismaGenerationJobStatus.SUCCEEDED],
    ['rejected', PrismaGenerationJobStatus.REJECTED],
  ] as const)('updates domain %s as Prisma %s', async (domain, prisma) => {
    const update = vi.fn().mockResolvedValue(prismaRecord(prisma));
    const repository = repositoryWith({ update });
    const result = await repository.updateGenerationJob(domainJob(domain));
    expect(update).toHaveBeenCalledWith({ where: { id: 'generation_shot_1_1' }, data: expect.objectContaining({ status: prisma }) });
    expect(result.status).toBe(domain);
  });

  it('reverse maps a fetched GenerationJob', async () => {
    const findFirst = vi.fn().mockResolvedValue(prismaRecord(PrismaGenerationJobStatus.SUCCEEDED));
    const result = await repositoryWith({ findFirst }).getGenerationJob('series_1', 'episode_1', 'scene_1', 'shot_1', 'generation_shot_1_1');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'generation_shot_1_1', seriesId: 'series_1', episodeId: 'episode_1', sceneId: 'scene_1', shotId: 'shot_1' } });
    expect(result?.status).toBe('completed');
  });

  it('reverse maps every listed GenerationJob', async () => {
    const findMany = vi.fn().mockResolvedValue([prismaRecord(PrismaGenerationJobStatus.RUNNING), prismaRecord(PrismaGenerationJobStatus.REJECTED)]);
    const result = await repositoryWith({ findMany }).listGenerationJobs('series_1', 'episode_1', 'scene_1', 'shot_1');
    expect(result.map((job) => job.status)).toEqual(['processing', 'rejected']);
  });

  it('keeps GenerationJob persistence free of broad never casts', () => {
    const source = readFileSync('lib/repositories/prisma.ts', 'utf8');
    for (const method of ['createGenerationJob', 'updateGenerationJob', 'getGenerationJob', 'listGenerationJobs']) {
      const line = source.split('\n').find((value) => value.includes(`async ${method}`));
      expect(line).toBeDefined();
      expect(line).not.toContain('as never');
    }
  });
});
