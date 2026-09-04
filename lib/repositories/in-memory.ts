import type { AgentExecution } from '@/lib/agents';
import type { ApprovalDecision, PipelineRun } from '@/lib/orchestration';
import type { ContinuityFact } from '@/types';
import type { PersistedUser, PersistenceRepository, ProductionMembershipRecord, PipelineStageStatus } from './contracts';

function clone<T>(value: T): T { return structuredClone(value); }

export class InMemoryPersistenceRepository implements PersistenceRepository {
  private users = new Map<string, PersistedUser>();
  private memberships = new Map<string, ProductionMembershipRecord>();
  private pipelines = new Map<string, PipelineRun>();
  private executions = new Map<string, AgentExecution>();
  private facts = new Map<string, ContinuityFact>();
  private stages = new Map<string, { status: PipelineStageStatus; output?: unknown; metadata: Record<string, string | number | boolean> }>();

  async getUser(id: string): Promise<PersistedUser | undefined> { const value = this.users.get(id); return value ? clone(value) : undefined; }
  async upsertUser(user: PersistedUser): Promise<PersistedUser> { this.users.set(user.id, clone(user)); return clone(user); }
  async getMembership(userId: string, seriesId: string): Promise<ProductionMembershipRecord | undefined> { const value = this.memberships.get(`${userId}:${seriesId}`); return value ? clone(value) : undefined; }
  async upsertMembership(record: ProductionMembershipRecord): Promise<ProductionMembershipRecord> { this.memberships.set(`${record.userId}:${record.seriesId}`, clone(record)); return clone(record); }
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
  async reset(): Promise<void> { this.users.clear(); this.memberships.clear(); this.pipelines.clear(); this.executions.clear(); this.facts.clear(); this.stages.clear(); }
}

export const memoryRepository = new InMemoryPersistenceRepository();
