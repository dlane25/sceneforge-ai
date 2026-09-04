import { ContinuityAgent, DirectorAgent, ScoringAgent, ShowrunnerAgent, WriterAgent } from '@/lib/agents';
import type { AgentContext, AgentExecution } from '@/lib/agents';
import { createMemorySnapshot } from '@/lib/agents/memory-snapshot';
import { EMPIRE_OF_LIES_CONTINUITY_FACTS, EMPIRE_OF_LIES_SERIES, EMPIRE_OF_LIES_STORY_FACTS, createEmpireOfLiesEpisodes } from '@/lib/mock';
import { MockVideoProvider } from '@/lib/video/mock-provider';
import type { GenerationJob } from '@/types';
import type { PipelineRun, PipelineSnapshot, PipelineState } from './types';

const pipelines = new Map<string, PipelineRun>();
const executions: AgentExecution[] = [];
let pipelineCounter = 0;

function createContext(episodeId: string, pipelineId?: string): AgentContext {
  const series = { ...EMPIRE_OF_LIES_SERIES, episodes: createEmpireOfLiesEpisodes() };
  return {
    series,
    episodeId,
    pipelineId,
    memory: createMemorySnapshot(series, EMPIRE_OF_LIES_CONTINUITY_FACTS, EMPIRE_OF_LIES_STORY_FACTS.map((fact) => fact.description)),
  };
}

function saveExecution<TInput, TOutput>(execution: AgentExecution<TInput, TOutput>): void { executions.push(execution as AgentExecution); }
function requirePipeline(id: string): PipelineRun { const pipeline = pipelines.get(id); if (!pipeline) throw new Error(`Pipeline ${id} was not found`); return pipeline; }
function update(pipeline: PipelineRun, state: PipelineState): void { pipeline.state = state; pipeline.updatedAt = new Date(); }

export class OrchestrationService {
  async run(episodeId = 'ep_1'): Promise<PipelineRun> {
    pipelineCounter += 1;
    const id = `pipeline_${pipelineCounter}`;
    const pipeline: PipelineRun = { id, seriesId: EMPIRE_OF_LIES_SERIES.id, episodeId, state: 'DRAFT', executions: [], createdAt: new Date(), updatedAt: new Date() };
    pipelines.set(id, pipeline);
    try {
      update(pipeline, 'ANALYZING');
      const context = createContext(episodeId, id);
      const showrunner = new ShowrunnerAgent();
      const showrunnerRequest = { agent: showrunner.identity, input: { concept: EMPIRE_OF_LIES_SERIES.logline }, context } as const;
      const showrunnerResponse = await showrunner.execute(showrunnerRequest);
      const showrunnerExecution = showrunner.createExecution(showrunnerRequest, showrunnerResponse, 1);
      pipeline.showrunner = showrunnerResponse.output; pipeline.executions.push(showrunnerExecution); saveExecution(showrunnerExecution);

      const outline = showrunnerResponse.output.episodeOutline.find((item) => item.episodeNumber === Number(episodeId.replace('ep_', ''))) || showrunnerResponse.output.episodeOutline[0];
      const writer = new WriterAgent();
      const writerRequest = { agent: writer.identity, input: outline, context };
      const writerResponse = await writer.execute(writerRequest);
      const writerExecution = writer.createExecution(writerRequest, writerResponse, 1);
      pipeline.screenplay = writerResponse.output; pipeline.executions.push(writerExecution); saveExecution(writerExecution);

      const director = new DirectorAgent();
      const directorRequest = { agent: director.identity, input: writerResponse.output, context };
      const directorResponse = await director.execute(directorRequest);
      const directorExecution = director.createExecution(directorRequest, directorResponse, 1);
      pipeline.shotPlan = directorResponse.output; pipeline.executions.push(directorExecution); saveExecution(directorExecution);

      update(pipeline, 'CONTINUITY_REVIEW');
      const continuity = new ContinuityAgent();
      const continuityRequest = { agent: continuity.identity, input: { screenplay: writerResponse.output, shotPlan: directorResponse.output }, context };
      const continuityResponse = await continuity.execute(continuityRequest);
      const continuityExecution = continuity.createExecution(continuityRequest, continuityResponse, 1);
      pipeline.continuity = continuityResponse.output; pipeline.executions.push(continuityExecution); saveExecution(continuityExecution);

      const scoring = new ScoringAgent();
      const scoringRequest = { agent: scoring.identity, input: writerResponse.output, context };
      const scoringResponse = await scoring.execute(scoringRequest);
      const scoringExecution = scoring.createExecution(scoringRequest, scoringResponse, 1);
      pipeline.scoring = scoringResponse.output; pipeline.executions.push(scoringExecution); saveExecution(scoringExecution);
      pipeline.approval = { id: `approval_${id}`, pipelineId: id, status: 'pending', requestedAction: 'Queue mock video generation for the approved shot plan.', summary: `${directorResponse.output.shots.length} shots are ready for review.`, projectedImpact: `Estimated ${directorResponse.output.totalDurationSeconds}s of vertical video; no paid provider will be called.`, requestedAt: new Date() };
      update(pipeline, 'READY_FOR_APPROVAL');
      return pipeline;
    } catch (error) {
      pipeline.error = error instanceof Error ? error.message : 'Agent execution failed'; update(pipeline, 'FAILED'); return pipeline;
    }
  }

  approve(id: string, note?: string): PipelineRun {
    const pipeline = requirePipeline(id); if (pipeline.state !== 'READY_FOR_APPROVAL' || !pipeline.approval) throw new Error('Pipeline is not awaiting approval');
    pipeline.approval = { ...pipeline.approval, status: 'approved', decisionAt: new Date(), decisionNote: note }; update(pipeline, 'APPROVED'); return pipeline;
  }

  reject(id: string, note?: string, revision = false): PipelineRun {
    const pipeline = requirePipeline(id); if (!pipeline.approval) throw new Error('Pipeline has no approval request');
    pipeline.approval = { ...pipeline.approval, status: revision ? 'revision_requested' : 'rejected', decisionAt: new Date(), decisionNote: note }; update(pipeline, revision ? 'DRAFT' : 'REJECTED'); return pipeline;
  }

  async queueGeneration(id: string): Promise<PipelineRun> {
    const pipeline = requirePipeline(id); if (pipeline.state !== 'APPROVED' || !pipeline.shotPlan) throw new Error('Human approval is required before generation');
    const provider = new MockVideoProvider();
    const job: GenerationJob = await provider.generateShot({ prompt: pipeline.shotPlan.shots[0]?.generationPrompt || 'Empire of Lies vertical drama shot', duration: pipeline.shotPlan.totalDurationSeconds, aspectRatio: '9:16', style: 'cinematic' });
    pipeline.generationJobId = job.id; update(pipeline, 'GENERATION_QUEUED'); return pipeline;
  }

  get(id: string): PipelineSnapshot { const pipeline = requirePipeline(id); return { id: pipeline.id, state: pipeline.state, episodeId: pipeline.episodeId, executionCount: pipeline.executions.length, approval: pipeline.approval, generationJobId: pipeline.generationJobId, output: { showrunner: pipeline.showrunner, screenplay: pipeline.screenplay, shotPlan: pipeline.shotPlan, continuity: pipeline.continuity, scoring: pipeline.scoring } }; }
  getFull(id: string): PipelineRun { return requirePipeline(id); }
  getExecutions(): AgentExecution[] { return [...executions]; }
}

export const orchestrationService = new OrchestrationService();
