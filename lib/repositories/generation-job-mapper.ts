import 'server-only';

import {
  GenerationJobStatus as PrismaGenerationJobStatus,
  Prisma,
  type GenerationJob as PrismaGenerationJobRecord,
} from '@prisma/client';
import type { GenerationJob, GenerationJobStatus, GenerationType } from '@/types';

export type PrismaGenerationStatus = (typeof PrismaGenerationJobStatus)[keyof typeof PrismaGenerationJobStatus];

export const DOMAIN_TO_PRISMA_GENERATION_STATUS = {
  draft: PrismaGenerationJobStatus.DRAFT,
  awaiting_approval: PrismaGenerationJobStatus.AWAITING_APPROVAL,
  approved: PrismaGenerationJobStatus.APPROVED,
  queued: PrismaGenerationJobStatus.QUEUED,
  processing: PrismaGenerationJobStatus.RUNNING,
  completed: PrismaGenerationJobStatus.SUCCEEDED,
  failed: PrismaGenerationJobStatus.FAILED,
  cancelled: PrismaGenerationJobStatus.CANCELLED,
  rejected: PrismaGenerationJobStatus.REJECTED,
} satisfies Record<GenerationJobStatus, PrismaGenerationStatus>;

export const PRISMA_TO_DOMAIN_GENERATION_STATUS = {
  DRAFT: 'draft',
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  QUEUED: 'queued',
  RUNNING: 'processing',
  SUCCEEDED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
} satisfies Record<PrismaGenerationStatus, GenerationJobStatus>;

export function toPrismaGenerationStatus(status: GenerationJobStatus): PrismaGenerationStatus {
  const mapped = DOMAIN_TO_PRISMA_GENERATION_STATUS[status];
  if (!mapped) throw new Error('Unsupported domain generation status');
  return mapped;
}

export function fromPrismaGenerationStatus(status: PrismaGenerationStatus): GenerationJobStatus {
  const mapped = PRISMA_TO_DOMAIN_GENERATION_STATUS[status];
  if (!mapped) throw new Error('Unsupported Prisma generation status');
  return mapped;
}

function toPrismaJsonValue(value: unknown, fieldName: string): Prisma.InputJsonValue {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item) => item === null ? null : toPrismaJsonValue(item, fieldName));
  if (value && typeof value === 'object') {
    const result: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) result[key] = item === null ? null : toPrismaJsonValue(item, fieldName);
    }
    return result;
  }
  throw new Error(`Generation job ${fieldName} must be JSON-compatible`);
}

function toPrismaJsonObject(value: Record<string, unknown> | undefined, fieldName: string): Prisma.InputJsonObject | undefined {
  if (!value) return undefined;
  const result: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) result[key] = item === null ? null : toPrismaJsonValue(item, fieldName);
  }
  return result;
}

function fromPrismaJsonValue(value: Prisma.JsonValue): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(fromPrismaJsonValue);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) throw new Error('Persisted generation job contains an invalid JSON value');
    result[key] = fromPrismaJsonValue(item);
  }
  return result;
}

function fromPrismaJsonObject(value: Prisma.JsonValue | null, fieldName: string): Record<string, unknown> | undefined {
  if (value === null) return undefined;
  if (Array.isArray(value) || typeof value !== 'object') throw new Error(`Persisted generation job ${fieldName} must be a JSON object`);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) throw new Error(`Persisted generation job ${fieldName} contains an invalid JSON value`);
    result[key] = fromPrismaJsonValue(item);
  }
  return result;
}

function requiredRelationId(value: string | null, fieldName: string): string {
  if (!value) throw new Error(`Persisted generation job is missing ${fieldName}`);
  return value;
}

function generationType(value: string): GenerationType {
  switch (value) {
    case 'video':
    case 'image':
    case 'image-to-video':
    case 'extension':
    case 'audio':
      return value;
    default:
      throw new Error('Persisted generation job has an unsupported generation type');
  }
}

function aspectRatio(value: string): GenerationJob['aspectRatio'] {
  switch (value) {
    case '9:16':
    case '16:9':
    case '1:1':
      return value;
    default:
      throw new Error('Persisted generation job has an unsupported aspect ratio');
  }
}

function providerStatus(value: string | null): GenerationJob['lastProviderStatus'] {
  if (value === null) return undefined;
  switch (value) {
    case 'queued':
    case 'processing':
    case 'succeeded':
    case 'failed':
    case 'cancelled':
    case 'polling_error':
      return value;
    default:
      throw new Error('Persisted generation job has an unsupported provider status');
  }
}

export function toPrismaGenerationJobCreate(job: GenerationJob): Prisma.GenerationJobUncheckedCreateInput {
  return {
    id: job.id,
    seriesId: job.seriesId,
    episodeId: job.episodeId,
    sceneId: job.sceneId,
    shotId: job.shotId,
    provider: job.provider,
    providerJobId: job.providerJobId,
    providerModel: job.providerModel,
    providerVoiceId: job.providerVoiceId,
    characterId: job.characterId,
    language: job.language,
    locale: job.locale,
    model: job.providerModel || 'default',
    generationType: job.generationType,
    status: toPrismaGenerationStatus(job.status),
    promptVersion: job.promptVersion,
    inputHash: job.inputHash,
    promptSnapshot: job.promptSnapshot,
    negativePromptSnapshot: job.negativePromptSnapshot,
    generationParameters: toPrismaJsonObject(job.generationParameters, 'generationParameters'),
    durationSeconds: job.durationSeconds,
    aspectRatio: job.aspectRatio,
    estimatedCost: job.estimatedCost,
    actualCost: job.actualCost,
    retryCount: job.retryCount,
    outputAssetIds: job.outputAssetIds,
    errorMessage: job.errorMessage,
    errorCode: job.errorCode,
    retryable: job.retryable,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    submittedAt: job.submittedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    updatedAt: job.updatedAt,
    lastPolledAt: job.lastPolledAt,
    lastProviderStatus: job.lastProviderStatus,
    lastProviderError: job.lastProviderError,
    providerMetadata: toPrismaJsonObject(job.providerMetadata, 'providerMetadata'),
    completionMetadata: toPrismaJsonObject(job.completionMetadata, 'completionMetadata'),
    failedAt: job.failedAt,
  };
}

export function toPrismaGenerationJobUpdate(job: GenerationJob): Prisma.GenerationJobUncheckedUpdateInput {
  return toPrismaGenerationJobCreate(job);
}

export function fromPrismaGenerationJob(record: PrismaGenerationJobRecord): GenerationJob {
  return {
    id: record.id,
    seriesId: record.seriesId,
    episodeId: requiredRelationId(record.episodeId, 'episodeId'),
    sceneId: requiredRelationId(record.sceneId, 'sceneId'),
    shotId: requiredRelationId(record.shotId, 'shotId'),
    provider: record.provider,
    providerJobId: record.providerJobId ?? undefined,
    providerModel: record.providerModel ?? undefined,
    providerVoiceId: record.providerVoiceId ?? undefined,
    characterId: record.characterId ?? undefined,
    language: record.language ?? undefined,
    locale: record.locale ?? undefined,
    generationType: generationType(record.generationType),
    status: fromPrismaGenerationStatus(record.status),
    promptVersion: record.promptVersion,
    inputHash: record.inputHash,
    promptSnapshot: record.promptSnapshot,
    negativePromptSnapshot: record.negativePromptSnapshot ?? undefined,
    generationParameters: fromPrismaJsonObject(record.generationParameters, 'generationParameters'),
    durationSeconds: record.durationSeconds,
    aspectRatio: aspectRatio(record.aspectRatio),
    estimatedCost: record.estimatedCost,
    actualCost: record.actualCost,
    retryCount: record.retryCount,
    outputAssetIds: [...record.outputAssetIds],
    errorMessage: record.errorMessage ?? undefined,
    errorCode: record.errorCode ?? undefined,
    retryable: record.retryable ?? undefined,
    createdAt: record.createdAt,
    startedAt: record.startedAt ?? undefined,
    submittedAt: record.submittedAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
    cancelledAt: record.cancelledAt ?? undefined,
    updatedAt: record.updatedAt,
    lastPolledAt: record.lastPolledAt ?? undefined,
    lastProviderStatus: providerStatus(record.lastProviderStatus),
    lastProviderError: record.lastProviderError ?? undefined,
    providerMetadata: fromPrismaJsonObject(record.providerMetadata, 'providerMetadata'),
    completionMetadata: fromPrismaJsonObject(record.completionMetadata, 'completionMetadata'),
    failedAt: record.failedAt ?? undefined,
  };
}
