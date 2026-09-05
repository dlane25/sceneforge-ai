import type { AgentExecution } from '@/lib/agents';
import type { ApprovalDecision, PipelineRun } from '@/lib/orchestration';
import type { ContinuityFact, Series } from '@/types';
import { EMPIRE_OF_LIES_CHARACTERS, EMPIRE_OF_LIES_SERIES, createEmpireOfLiesEpisodes } from '@/lib/mock';
import type { PersistedUser, PersistenceRepository, ProductionMembershipRecord, PipelineStageStatus, SeriesInput } from './contracts';

function clone<T>(value: T): T { return structuredClone(value); }

export class InMemoryPersistenceRepository implements PersistenceRepository {
  private users = new Map<string, PersistedUser>();
  private memberships = new Map<string, ProductionMembershipRecord>();
  private pipelines = new Map<string, PipelineRun>();
  private executions = new Map<string, AgentExecution>();
  private facts = new Map<string, ContinuityFact>();
  private stages = new Map<string, { status: PipelineStageStatus; output?: unknown; metadata: Record<string, string | number | boolean> }>();
  private series = new Map<string, Series>();

  constructor() {
    this.series.set(EMPIRE_OF_LIES_SERIES.id, clone({ ...EMPIRE_OF_LIES_SERIES, characters: EMPIRE_OF_LIES_CHARACTERS, episodes: createEmpireOfLiesEpisodes() }));
  }
  async getUser(id: string): Promise<PersistedUser | undefined> { const value = this.users.get(id); return value ? clone(value) : undefined; }
  async findUserByEmail(email: string): Promise<PersistedUser | undefined> { const value = [...this.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase()); return value ? clone(value) : undefined; }
  async upsertUser(user: PersistedUser): Promise<PersistedUser> { this.users.set(user.id, clone(user)); return clone(user); }
  async upsertUserIdentity(user: Omit<PersistedUser, 'id'>): Promise<PersistedUser> {
    const existing = [...this.users.values()].find((value) => (value.provider === user.provider && value.providerSubject === user.providerSubject) || value.email.toLowerCase() === user.email.toLowerCase());
    const record = existing || { ...user, id: `user_${user.provider}_${user.providerSubject}`.replace(/[^a-zA-Z0-9_-]/g, '_') };
    this.users.set(record.id, clone(record));
    return clone(record);
  }
  async getMembership(userId: string, seriesId: string): Promise<ProductionMembershipRecord | undefined> { const value = this.memberships.get(`${userId}:${seriesId}`); return value ? clone(value) : undefined; }
  async upsertMembership(record: ProductionMembershipRecord): Promise<ProductionMembershipRecord> { this.memberships.set(`${record.userId}:${record.seriesId}`, clone(record)); return clone(record); }
  async listMemberships(seriesId: string): Promise<ProductionMembershipRecord[]> { return [...this.memberships.values()].filter((value) => value.seriesId === seriesId).map(clone); }
  async removeMembership(userId: string, seriesId: string): Promise<void> { this.memberships.delete(`${userId}:${seriesId}`); }
  async listAccessibleSeries(userId: string): Promise<Series[]> { const ids = [...this.memberships.values()].filter((value) => value.userId === userId).map((value) => value.seriesId); return [...this.series.values()].filter((value) => ids.includes(value.id)).map(clone); }
  async getSeries(seriesId: string): Promise<Series | undefined> { const value = this.series.get(seriesId); return value ? clone(value) : undefined; }
  async createSeries(ownerId: string, input: SeriesInput): Promise<Series> { const id = `series_${this.series.size + 1}`; const now = new Date(); const value: Series = { id, title: input.title, logline: input.logline, genre: input.genre, targetAudience: input.targetAudience, visualStyle: input.visualStyle, episodeCount: input.episodeCount, episodeDurationSeconds: input.episodeDurationSeconds, status: (input.status || 'draft') as Series['status'], characters: [], episodes: [], createdAt: now, updatedAt: now }; this.series.set(id, clone(value)); await this.upsertMembership({ id: `membership_${id}_${ownerId}`, userId: ownerId, seriesId: id, role: 'OWNER' }); return clone(value); }
  async updateSeries(seriesId: string, input: Partial<SeriesInput>): Promise<Series> { const value = this.series.get(seriesId); if (!value) throw new Error(`Series ${seriesId} was not found`); const updated = { ...value, ...input, status: (input.status || value.status) as Series['status'], updatedAt: new Date() }; this.series.set(seriesId, clone(updated)); return clone(updated); }
  async archiveSeries(seriesId: string): Promise<Series> { return this.updateSeries(seriesId, { status: 'archived' }); }
  async create(pipeline: PipelineRun): Promise<PipelineRun> { this.pipelines.set(pipeline.id, clone(pipeline)); return clone(pipeline); }
  async get(id: string): Promise<PipelineRun | undefined> { const value = this.pipelines.get(id); return value ? clone(value) : undefined; }
  async update(pipeline: PipelineRun): Promise<PipelineRun> { this.pipelines.set(pipeline.id, clone(pipeline)); return clone(pipeline); }
  async listExecutions(pipelineId?: string): Promise<AgentExecution[]> { return [...this.executions.values()].filter((execution) => !pipelineId || pipelineId === execution.metadata.pipelineId).map(clone); }
  async saveExecution(execution: AgentExecution, pipelineId: string): Promise<AgentExecution> { this.executions.set(execution.id, clone({ ...execution, metadata: { ...execution.metadata, pipelineId } })); return clone(execution); }
  async saveApproval(approval: ApprovalDecision): Promise<ApprovalDecision> { const pipeline = this.pipelines.get(approval.pipelineId); if (pipeline) { pipeline.approval = clone(approval); this.pipelines.set(pipeline.id, pipeline); } return clone(approval); }
  async saveStage(pipelineId: string, stageKey: string, status: PipelineStageStatus, output?: unknown, metadata: Record<string, string | number | boolean> = {}): Promise<void> { this.stages.set(`${pipelineId}:${stageKey}`, clone({ status, output, metadata })); }
  async addFact(fact: ContinuityFact): Promise<ContinuityFact> { this.facts.set(fact.id, clone(fact)); return clone(fact); }
  async listFacts(seriesId: string): Promise<ContinuityFact[]> { return [...this.facts.values()].filter((fact) => fact.seriesId === seriesId).map(clone); }
  async getActiveFacts(seriesId: string, episodeNumber: number, sceneNumber?: number, shotNumber?: number): Promise<ContinuityFact[]> {
    const facts = await this.listFacts(seriesId);
    return facts.filter((fact) => {
      if (episodeNumber < fact.validFromEpisode || (fact.validToEpisode !== undefined && episodeNumber > fact.validToEpisode)) return false;
      if (fact.validFromScene !== undefined && episodeNumber === fact.validFromEpisode && sceneNumber !== undefined && sceneNumber < fact.validFromScene) return false;
      if (fact.validToScene !== undefined && episodeNumber === fact.validToEpisode && sceneNumber !== undefined && sceneNumber > fact.validToScene) return false;
      if (fact.validFromShot !== undefined && sceneNumber === fact.validFromScene && shotNumber !== undefined && shotNumber < fact.validFromShot) return false;
      if (fact.validToShot !== undefined && sceneNumber === fact.validToScene && shotNumber !== undefined && shotNumber > fact.validToShot) return false;
      return true;
    });
  }
  async reset(): Promise<void> { this.users.clear(); this.memberships.clear(); this.pipelines.clear(); this.executions.clear(); this.facts.clear(); this.stages.clear(); this.series.clear(); this.series.set(EMPIRE_OF_LIES_SERIES.id, clone({ ...EMPIRE_OF_LIES_SERIES, characters: EMPIRE_OF_LIES_CHARACTERS, episodes: createEmpireOfLiesEpisodes() })); }
}

export const memoryRepository = new InMemoryPersistenceRepository();
