import type { Agent, AgentContext, AgentExecution, AgentRequest, AgentResponse, AgentIdentity } from './types';

let executionCounter = 0;

export abstract class DeterministicAgent<TInput, TOutput> implements Agent<TInput, TOutput> {
  abstract readonly identity: AgentIdentity;
  protected abstract run(input: TInput, context: AgentContext): AgentResponse<TOutput>;

  async execute(request: AgentRequest<TInput>): Promise<AgentResponse<TOutput>> {
    return this.run(request.input, request.context);
  }

  protected nextExecutionId(): string {
    executionCounter += 1;
    return `exec_${this.identity}_${executionCounter}`;
  }

  createExecution<TInput, TOutput>(
    request: AgentRequest<TInput>,
    response: AgentResponse<TOutput>,
    durationMs: number,
    error?: { code: string; message: string; retryable: boolean },
  ): AgentExecution<TInput, TOutput> {
    return {
      id: this.nextExecutionId(),
      agent: this.identity,
      seriesId: request.context.series.id,
      episodeId: request.context.episodeId,
      input: request.input,
      output: response.output,
      status: error ? 'failed' : 'succeeded',
      confidence: response.confidence,
      explanation: response.explanation,
      timestamp: new Date(),
      durationMs,
      errors: error ? [error] : [],
      metadata: response.metadata,
    };
  }
}
