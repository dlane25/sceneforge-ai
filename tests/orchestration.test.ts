import { describe, expect, it } from 'vitest';
import { DeterministicAgent } from '@/lib/agents';
import type { AgentContext } from '@/lib/agents';
import { OrchestrationService } from '@/lib/orchestration';
import { EMPIRE_OF_LIES_SERIES, createEmpireOfLiesEpisodes } from '@/lib/mock';

describe('orchestration service', () => {
  it('runs the complete pipeline and stops for human approval', async () => {
    const service = new OrchestrationService();
    const pipeline = await service.run('ep_1');

    expect(pipeline.state).toBe('READY_FOR_APPROVAL');
    expect(pipeline.executions.map((execution) => execution.agent)).toEqual(['showrunner', 'writer', 'director', 'continuity', 'scoring']);
    expect(pipeline.screenplay?.estimatedDurationSeconds).toBe(72);
    expect(pipeline.shotPlan?.aspectRatio).toBe('9:16');
    expect(pipeline.approval?.status).toBe('pending');
  });

  it('detects the intentional continuity mismatch in the pipeline', async () => {
    const service = new OrchestrationService();
    const pipeline = await service.run('ep_1');

    expect(pipeline.continuity?.passed).toBe(false);
    expect(pipeline.continuity?.findings[0].factId).toBe('cont_1_marcus_watch');
  });

  it('cannot queue generation before approval, then queues after approval', async () => {
    const service = new OrchestrationService();
    const pipeline = await service.run('ep_1');

    await expect(service.queueGeneration(pipeline.id)).rejects.toThrow('Human approval is required');
    await service.approve(pipeline.id, 'Approved for mock generation');
    const queued = await service.queueGeneration(pipeline.id);
    expect(queued.state).toBe('GENERATION_QUEUED');
    expect(queued.generationJobId).toContain('job_shot_');
  });

  it('records rejection without starting generation', async () => {
    const service = new OrchestrationService();
    const pipeline = await service.run('ep_1');
    const rejected = await service.reject(pipeline.id, 'Revise the hook');

    expect(rejected.state).toBe('REJECTED');
    expect(rejected.approval?.decisionNote).toBe('Revise the hook');
    await expect(service.queueGeneration(pipeline.id)).rejects.toThrow('Human approval is required');
  });
});

describe('agent execution failures', () => {
  it('records a failed execution with an audit-safe error summary', async () => {
    class FailingAgent extends DeterministicAgent<{ input: string }, { output: string }> {
      readonly identity = 'writer' as const;
      protected run(): { output: { output: string }; explanation: string; warnings: string[]; metadata: Record<string, string | number | boolean> } {
        throw new Error('fixture failure');
      }
    }
    const agent = new FailingAgent();
    const context: AgentContext = { series: { ...EMPIRE_OF_LIES_SERIES, episodes: createEmpireOfLiesEpisodes() }, memory: { characterFacts: [], worldFacts: [], storyFacts: [], continuityFacts: [], unresolvedThreads: [] } };
    const request = { agent: 'writer' as const, input: { input: 'fixture' }, context };
    const response = { output: { output: '' }, explanation: 'Execution failed before output.', warnings: [], metadata: {} };
    const execution = agent.createExecution(request, response, 2, { code: 'FIXTURE_FAILURE', message: 'fixture failure', retryable: false });

    expect(execution.status).toBe('failed');
    expect(execution.errors[0].message).toBe('fixture failure');
    expect(execution.output).toEqual({ output: '' });
  });
});
