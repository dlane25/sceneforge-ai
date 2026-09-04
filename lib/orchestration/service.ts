import { ContinuityAgent, DirectorAgent, ScoringAgent, ShowrunnerAgent, WriterAgent } from '@/lib/agents';
import type { AgentContext, AgentExecution } from '@/lib/agents';
import { createMemorySnapshot } from '@/lib/agents/memory-snapshot';
import { runtimeRepository } from '@/lib/repositories';
import type { PersistenceRepository } from '@/lib/repositories';
import { EMPIRE_OF_LIES_CONTINUITY_FACTS, EMPIRE_OF_LIES_SERIES, EMPIRE_OF_LIES_STORY_FACTS, createEmpireOfLiesEpisodes } from '@/lib/mock';
import { MockVideoProvider } from '@/lib/video/mock-provider';
import type { GenerationJob } from '@/types';
import type { PipelineRun, PipelineSnapshot, PipelineState } from './types';

let pipelineCounter = 0;

function createContext(episodeId: string, pipelineId: string): AgentContext {
  const series = { ...EMPIRE_OF_LIES_SERIES, episodes: createEmpireOfLiesEpisodes() };
  return {
    series,
    episodeId,
    pipelineId,
    memory: createMemorySnapshot(series, EMPIRE_OF_LIES_CONTINUITY_FACTS, EMPIRE_OF_LIES_STORY_FACTS.map((fact) => fact.description)),
  };
}

function update(pipeline: PipelineRun, state: PipelineState): void {
  pipeline.state = state;
  pipeline.updatedAt = new Date();
}

export class OrchestrationService {
  constructor(private readonly repository: PersistenceRepository = runtimeRepository) {}

  async run(episodeId = 'ep_1', seriesId = EMPIRE_OF_LIES_SERIES.id, initiatedById = 'demo-user'): Promise<PipelineRun> {
    episodeId = episodeId.startsWith('ep_') ? episodeId : `ep_${episodeId}`;
    pipelineCounter += 1;
    const id = `pipeline_${pipelineCounter}`;
    const pipeline: PipelineRun = { id, seriesId, episodeId, initiatedById, state: 'DRAFT', executions: [], createdAt: new Date(), updatedAt: new Date() };
    await this.repository.create(pipeline);

    try {
      for (const fact of EMPIRE_OF_LIES_CONTINUITY_FACTS) await this.repository.addFact(fact);
      update(pipeline, 'ANALYZING');
      await this.repository.update(pipeline);
      const context = createContext(episodeId, id);

      const showrunner = new ShowrunnerAgent();
      const showrunnerRequest = { agent: showrunner.identity, input: { concept: EMPIRE_OF_LIES_SERIES.logline }, context } as const;
      const showrunnerResponse = await showrunner.execute(showrunnerRequest);
      await this.recordExecution(pipeline, showrunner.createExecution(showrunnerRequest, showrunnerResponse, 1));
      await this.repository.saveStage(id, 'SHOWRUNNER', 'SUCCEEDED', showrunnerResponse.output, showrunnerResponse.metadata);
      pipeline.showrunner = showrunnerResponse.output;

      const outline = showrunnerResponse.output.episodeOutline.find((item) => item.episodeNumber === Number(episodeId.replace('ep_', ''))) || showrunnerResponse.output.episodeOutline[0];
      const writer = new WriterAgent();
      const writerRequest = { agent: writer.identity, input: outline, context };
      const writerResponse = await writer.execute(writerRequest);
      await this.recordExecution(pipeline, writer.createExecution(writerRequest, writerResponse, 1));
      await this.repository.saveStage(id, 'WRITER', 'SUCCEEDED', writerResponse.output, writerResponse.metadata);
      pipeline.screenplay = writerResponse.output;

      const director = new DirectorAgent();
      const directorRequest = { agent: director.identity, input: writerResponse.output, context };
      const directorResponse = await director.execute(directorRequest);
      await this.recordExecution(pipeline, director.createExecution(directorRequest, directorResponse, 1));
      await this.repository.saveStage(id, 'DIRECTOR', 'SUCCEEDED', directorResponse.output, directorResponse.metadata);
      pipeline.shotPlan = directorResponse.output;

      update(pipeline, 'CONTINUITY_REVIEW');
      await this.repository.update(pipeline);
      const continuity = new ContinuityAgent();
      const continuityRequest = { agent: continuity.identity, input: { screenplay: writerResponse.output, shotPlan: directorResponse.output }, context };
      const continuityResponse = await continuity.execute(continuityRequest);
      await this.recordExecution(pipeline, continuity.createExecution(continuityRequest, continuityResponse, 1));
      await this.repository.saveStage(id, 'CONTINUITY', 'SUCCEEDED', continuityResponse.output, continuityResponse.metadata);
      pipeline.continuity = continuityResponse.output;

      const scoring = new ScoringAgent();
      const scoringRequest = { agent: scoring.identity, input: writerResponse.output, context };
      const scoringResponse = await scoring.execute(scoringRequest);
      await this.recordExecution(pipeline, scoring.createExecution(scoringRequest, scoringResponse, 1));
      await this.repository.saveStage(id, 'SCORING', 'SUCCEEDED', scoringResponse.output, scoringResponse.metadata);
      pipeline.scoring = scoringResponse.output;
      pipeline.approval = { id: `approval_${id}`, pipelineId: id, status: 'pending', requestedAction: 'Queue mock video generation for the approved shot plan.', summary: `${directorResponse.output.shots.length} shots are ready for review.`, projectedImpact: `Estimated ${directorResponse.output.totalDurationSeconds}s of vertical video; no paid provider will be called.`, requestedAt: new Date() };
      await this.repository.saveApproval(pipeline.approval);
      update(pipeline, 'READY_FOR_APPROVAL');
      return await this.repository.update(pipeline);
    } catch (error) {
      pipeline.error = error instanceof Error ? error.message : 'Agent execution failed';
      update(pipeline, 'FAILED');
      return await this.repository.update(pipeline);
    }
  }

  async approve(id: string, note?: string): Promise<PipelineRun> {
    const pipeline = await this.requirePipeline(id);
    if (pipeline.state !== 'READY_FOR_APPROVAL' || !pipeline.approval) throw new Error('Pipeline is not awaiting approval');
    pipeline.approval = { ...pipeline.approval, status: 'approved', decisionAt: new Date(), decisionNote: note };
    await this.repository.saveApproval(pipeline.approval);
    update(pipeline, 'APPROVED');
    return this.repository.update(pipeline);
  }

  async reject(id: string, note?: string, revision = false): Promise<PipelineRun> {
    const pipeline = await this.requirePipeline(id);
    if (!pipeline.approval) throw new Error('Pipeline has no approval request');
    pipeline.approval = { ...pipeline.approval, status: revision ? 'revision_requested' : 'rejected', decisionAt: new Date(), decisionNote: note };
    await this.repository.saveApproval(pipeline.approval);
    update(pipeline, revision ? 'DRAFT' : 'REJECTED');
    return this.repository.update(pipeline);
  }

  async queueGeneration(id: string): Promise<PipelineRun> {
    const pipeline = await this.requirePipeline(id);
    if (pipeline.state !== 'APPROVED' || !pipeline.shotPlan) throw new Error('Human approval is required before generation');
    const provider = new MockVideoProvider();
    const job: GenerationJob = await provider.generateShot({ prompt: pipeline.shotPlan.shots[0]?.generationPrompt || 'Empire of Lies vertical drama shot', duration: pipeline.shotPlan.totalDurationSeconds, aspectRatio: '9:16', style: 'cinematic' });
    pipeline.generationJobId = job.id;
    update(pipeline, 'GENERATION_QUEUED');
    return this.repository.update(pipeline);
  }

  async get(id: string): Promise<PipelineSnapshot> {
    const pipeline = await this.requirePipeline(id);
    return { id: pipeline.id, state: pipeline.state, episodeId: pipeline.episodeId, executionCount: pipeline.executions.length, approval: pipeline.approval, generationJobId: pipeline.generationJobId, output: { showrunner: pipeline.showrunner, screenplay: pipeline.screenplay, shotPlan: pipeline.shotPlan, continuity: pipeline.continuity, scoring: pipeline.scoring } };
  }

  async getFull(id: string): Promise<PipelineRun> { return this.requirePipeline(id); }
  async getExecutions(pipelineId?: string): Promise<AgentExecution[]> { return this.repository.listExecutions(pipelineId); }

  private async requirePipeline(id: string): Promise<PipelineRun> {
    const pipeline = await this.repository.get(id);
    if (!pipeline) throw new Error(`Pipeline ${id} was not found`);
    return pipeline;
  }

  private async recordExecution(pipeline: PipelineRun, execution: AgentExecution): Promise<void> {
    pipeline.executions.push(execution);
    await this.repository.saveExecution(execution, pipeline.id);
    await this.repository.update(pipeline);
  }
}

export const orchestrationService = new OrchestrationService();
