import type { AgentExecution } from '@/lib/agents';
import type { ApprovalDecision, PipelineRun } from '@/lib/orchestration';
import type { ContinuityFact } from '@/types';

export type RepositoryRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface ProductionMembershipRecord {
  id: string;
  userId: string;
  seriesId: string;
  role: RepositoryRole;
}

export interface PersistedUser {
  id: string;
  email: string;
  displayName: string;
}

export type PipelineStageStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface PipelineRepository {
  create(pipeline: PipelineRun): Promise<PipelineRun>;
  get(id: string): Promise<PipelineRun | undefined>;
  update(pipeline: PipelineRun): Promise<PipelineRun>;
  listExecutions(pipelineId?: string): Promise<AgentExecution[]>;
  saveExecution(execution: AgentExecution, pipelineId: string): Promise<AgentExecution>;
  saveApproval(approval: ApprovalDecision): Promise<ApprovalDecision>;
  saveStage(pipelineId: string, stageKey: string, status: PipelineStageStatus, output?: unknown, metadata?: Record<string, string | number | boolean>): Promise<void>;
}

export interface MembershipRepository {
  getMembership(userId: string, seriesId: string): Promise<ProductionMembershipRecord | undefined>;
  upsertMembership(record: ProductionMembershipRecord): Promise<ProductionMembershipRecord>;
}

export interface SeriesMemoryRepository {
  addFact(fact: ContinuityFact): Promise<ContinuityFact>;
  listFacts(seriesId: string): Promise<ContinuityFact[]>;
  getActiveFacts(seriesId: string, episodeNumber: number, sceneNumber?: number, shotNumber?: number): Promise<ContinuityFact[]>;
}

export interface PersistenceRepository extends PipelineRepository, MembershipRepository, SeriesMemoryRepository {
  getUser(id: string): Promise<PersistedUser | undefined>;
  upsertUser(user: PersistedUser): Promise<PersistedUser>;
  reset(): Promise<void>;
}

export function isWriteRole(role: RepositoryRole): boolean {
  return role === 'OWNER' || role === 'EDITOR';
}
