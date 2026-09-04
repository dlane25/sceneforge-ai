import type { AgentExecution, ContinuityReview, ScoringOutput, Screenplay, ShowrunnerOutput, ShotPlan } from '@/lib/agents';

export type PipelineState = 'DRAFT' | 'ANALYZING' | 'CONTINUITY_REVIEW' | 'READY_FOR_APPROVAL' | 'APPROVED' | 'REJECTED' | 'GENERATION_QUEUED' | 'FAILED';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';

export interface ApprovalDecision {
  id: string;
  pipelineId: string;
  status: ApprovalStatus;
  requestedAction: string;
  summary: string;
  projectedImpact: string;
  requestedAt: Date;
  decisionAt?: Date;
  decisionNote?: string;
}

export interface PipelineRun {
  id: string;
  seriesId: string;
  episodeId: string;
  initiatedById: string;
  state: PipelineState;
  showrunner?: ShowrunnerOutput;
  screenplay?: Screenplay;
  shotPlan?: ShotPlan;
  continuity?: ContinuityReview;
  scoring?: ScoringOutput;
  executions: AgentExecution[];
  approval?: ApprovalDecision;
  generationJobId?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineSnapshot {
  id: string;
  state: PipelineState;
  episodeId: string;
  executionCount: number;
  approval?: ApprovalDecision;
  generationJobId?: string;
  output: { showrunner?: ShowrunnerOutput; screenplay?: Screenplay; shotPlan?: ShotPlan; continuity?: ContinuityReview; scoring?: ScoringOutput };
}
