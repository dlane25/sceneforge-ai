import type { PrismaClient } from '@prisma/client';
import type { AgentExecution } from '@/lib/agents';
import type { ApprovalDecision, PipelineRun } from '@/lib/orchestration';
import type { ContinuityFact } from '@/types';
import type { PersistedUser, PersistenceRepository, ProductionMembershipRecord, RepositoryRole, PipelineStageStatus } from './contracts';
import { EMPIRE_OF_LIES_SERIES, createEmpireOfLiesEpisodes } from '@/lib/mock';

export class PrismaPersistenceRepository implements PersistenceRepository {
  constructor(private readonly db: PrismaClient) {}

  async getUser(id: string): Promise<PersistedUser | undefined> {
    const user = await this.db.user.findUnique({ where: { id } });
    return user ? { id: user.id, email: user.email, displayName: user.displayName } : undefined;
  }
  async upsertUser(user: PersistedUser): Promise<PersistedUser> {
    const value = await this.db.user.upsert({ where: { id: user.id }, create: user, update: { email: user.email, displayName: user.displayName } });
    return { id: value.id, email: value.email, displayName: value.displayName };
  }
  async getMembership(userId: string, seriesId: string): Promise<ProductionMembershipRecord | undefined> {
    if (seriesId === EMPIRE_OF_LIES_SERIES.id) await this.ensureDemoProduction(userId);
    const value = await this.db.productionMembership.findUnique({ where: { userId_seriesId: { userId, seriesId } } });
    return value ? { id: value.id, userId: value.userId, seriesId: value.seriesId, role: value.role as RepositoryRole } : undefined;
  }
  async upsertMembership(record: ProductionMembershipRecord): Promise<ProductionMembershipRecord> {
    const value = await this.db.productionMembership.upsert({ where: { userId_seriesId: { userId: record.userId, seriesId: record.seriesId } }, create: { id: record.id, userId: record.userId, seriesId: record.seriesId, role: record.role }, update: { role: record.role } });
    return { id: value.id, userId: value.userId, seriesId: value.seriesId, role: value.role as RepositoryRole };
  }
  async create(pipeline: PipelineRun): Promise<PipelineRun> { await this.db.pipelineRun.create({ data: { id: pipeline.id, seriesId: pipeline.seriesId, episodeId: pipeline.episodeId, initiatedById: pipeline.initiatedById, state: pipeline.state, output: pipeline as object, error: pipeline.error } }); return pipeline; }
  async get(id: string): Promise<PipelineRun | undefined> { const value = await this.db.pipelineRun.findUnique({ where: { id } }); return value?.output ? value.output as unknown as PipelineRun : undefined; }
  async update(pipeline: PipelineRun): Promise<PipelineRun> { await this.db.pipelineRun.update({ where: { id: pipeline.id }, data: { state: pipeline.state, output: pipeline as object, generationJobId: pipeline.generationJobId, error: pipeline.error } }); return pipeline; }
  async listExecutions(pipelineId?: string): Promise<AgentExecution[]> { const values = await this.db.agentExecution.findMany({ where: pipelineId ? { pipelineId } : undefined, orderBy: { timestamp: 'asc' } }); return values.map((value) => ({ id: value.id, agent: value.agent as AgentExecution['agent'], seriesId: value.seriesId, episodeId: value.episodeId || undefined, input: value.input, output: value.output || undefined, status: value.status.toLowerCase() as AgentExecution['status'], confidence: value.confidence || undefined, explanation: value.explanation || undefined, timestamp: value.timestamp, durationMs: value.durationMs, errors: value.errors as unknown as AgentExecution['errors'], metadata: value.metadata as unknown as AgentExecution['metadata'] })); }
  async saveExecution(execution: AgentExecution, pipelineId: string): Promise<AgentExecution> { await this.db.agentExecution.create({ data: { id: execution.id, pipelineId, agent: execution.agent, seriesId: execution.seriesId, episodeId: execution.episodeId, input: execution.input as object, output: execution.output as object, status: execution.status.toUpperCase() as 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED', confidence: execution.confidence, explanation: execution.explanation, timestamp: execution.timestamp, durationMs: execution.durationMs, errors: execution.errors as object, metadata: execution.metadata as object } }); return execution; }
  async saveApproval(approval: ApprovalDecision): Promise<ApprovalDecision> { await this.db.approvalDecision.upsert({ where: { id: approval.id }, create: { id: approval.id, pipelineId: approval.pipelineId, status: approval.status.toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED', requestedAction: approval.requestedAction, summary: approval.summary, projectedImpact: approval.projectedImpact, requestedAt: approval.requestedAt, decisionAt: approval.decisionAt, decisionNote: approval.decisionNote }, update: { status: approval.status.toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED', decisionAt: approval.decisionAt, decisionNote: approval.decisionNote } }); return approval; }
  async saveStage(pipelineId: string, stageKey: string, status: PipelineStageStatus, output?: unknown, metadata: Record<string, string | number | boolean> = {}): Promise<void> { await this.db.pipelineStage.upsert({ where: { pipelineId_stageKey: { pipelineId, stageKey } }, create: { id: `stage_${pipelineId}_${stageKey}`, pipelineId, stageKey, status, output: output as object, metadata }, update: { status, output: output as object, metadata } }); }
  async addFact(fact: ContinuityFact): Promise<ContinuityFact> { await this.db.seriesMemoryFact.upsert({ where: { id: fact.id }, create: { ...fact, subjectType: fact.subjectType, override: fact.override ?? false }, update: { value: fact.value, validToEpisode: fact.validToEpisode, validToScene: fact.validToScene, validToShot: fact.validToShot, confidence: fact.confidence, override: fact.override ?? false } }); return fact; }
  async listFacts(seriesId: string): Promise<ContinuityFact[]> { const values = await this.db.seriesMemoryFact.findMany({ where: { seriesId } }); return values.map((value) => ({ id: value.id, seriesId: value.seriesId, subjectType: value.subjectType as ContinuityFact['subjectType'], subjectId: value.subjectId, key: value.key, value: value.value, validFromEpisode: value.validFromEpisode, validFromScene: value.validFromScene ?? undefined, validFromShot: value.validFromShot ?? undefined, validToEpisode: value.validToEpisode ?? undefined, validToScene: value.validToScene ?? undefined, validToShot: value.validToShot ?? undefined, source: value.source, confidence: value.confidence, override: value.override, createdAt: value.createdAt, updatedAt: value.updatedAt })); }
  async getActiveFacts(seriesId: string, episodeNumber: number, sceneNumber?: number, shotNumber?: number): Promise<ContinuityFact[]> { const facts = await this.listFacts(seriesId); return facts.filter((fact) => episodeNumber >= fact.validFromEpisode && (fact.validToEpisode === undefined || episodeNumber <= fact.validToEpisode) && (fact.validFromScene === undefined || sceneNumber === undefined || episodeNumber !== fact.validFromEpisode || sceneNumber >= fact.validFromScene) && (fact.validToScene === undefined || sceneNumber === undefined || episodeNumber !== fact.validToEpisode || sceneNumber <= fact.validToScene) && (fact.validFromShot === undefined || shotNumber === undefined || shotNumber >= fact.validFromShot) && (fact.validToShot === undefined || shotNumber === undefined || shotNumber <= fact.validToShot)); }
  async reset(): Promise<void> { throw new Error('Reset is not supported by the Prisma repository'); }

  private async ensureDemoProduction(ownerId: string): Promise<void> {
    await this.db.series.upsert({ where: { id: EMPIRE_OF_LIES_SERIES.id }, create: { id: EMPIRE_OF_LIES_SERIES.id, title: EMPIRE_OF_LIES_SERIES.title, logline: EMPIRE_OF_LIES_SERIES.logline, genre: EMPIRE_OF_LIES_SERIES.genre, targetAudience: EMPIRE_OF_LIES_SERIES.targetAudience, visualStyle: EMPIRE_OF_LIES_SERIES.visualStyle, episodeCount: EMPIRE_OF_LIES_SERIES.episodeCount, episodeDurationSeconds: EMPIRE_OF_LIES_SERIES.episodeDurationSeconds, status: EMPIRE_OF_LIES_SERIES.status, ownerId }, update: {} });
    for (const episode of createEmpireOfLiesEpisodes()) {
      await this.db.episode.upsert({ where: { seriesId_episodeNumber: { seriesId: EMPIRE_OF_LIES_SERIES.id, episodeNumber: episode.episodeNumber } }, create: { id: episode.id, seriesId: EMPIRE_OF_LIES_SERIES.id, episodeNumber: episode.episodeNumber, title: episode.title, hook: episode.hook, synopsis: episode.synopsis, cliffhanger: episode.cliffhanger }, update: { title: episode.title, hook: episode.hook, synopsis: episode.synopsis, cliffhanger: episode.cliffhanger } });
    }
  }
}
