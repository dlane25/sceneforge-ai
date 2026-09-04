export type GenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  provider: string;
  model: string;
  status: GenerationJobStatus;
  promptVersion: string;
  inputHash: string;
  estimatedCost: number;
  actualCost: number;
  retryCount: number;
  outputAssetIds: string[];
  errorMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
}
