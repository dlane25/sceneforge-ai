import type { GenerationJob, GenerationJobStatus } from '@/types';

export interface GenerationJobFilter {
  status?: GenerationJobStatus;
  provider?: string;
  model?: string;
  limit?: number;
  offset?: number;
}

export class GenerationJobRepository {
  private jobs: Map<string, GenerationJob> = new Map();
  private jobIdCounter = 0;

  create(jobData: Omit<GenerationJob, 'id' | 'createdAt' | 'updatedAt'>): GenerationJob {
    const id = `job_${this.jobIdCounter++}_${Date.now()}`;
    const now = new Date();

    const job: GenerationJob = {
      ...jobData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);
    return job;
  }

  getById(id: string): GenerationJob | undefined {
    return this.jobs.get(id);
  }

  update(id: string, updates: Partial<Omit<GenerationJob, 'id' | 'createdAt'>>): GenerationJob | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    const updated: GenerationJob = {
      ...job,
      ...updates,
      id: job.id,
      createdAt: job.createdAt,
      updatedAt: new Date(),
    };

    this.jobs.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.jobs.delete(id);
  }

  find(filter: GenerationJobFilter): GenerationJob[] {
    let results = Array.from(this.jobs.values());

    if (filter.status) {
      results = results.filter((job) => job.status === filter.status);
    }

    if (filter.provider) {
      results = results.filter((job) => job.provider === filter.provider);
    }

    if (filter.model) {
      results = results.filter((job) => job.model === filter.model);
    }

    // Apply offset and limit
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;

    return results.slice(offset, offset + limit);
  }

  findByStatus(status: GenerationJobStatus): GenerationJob[] {
    return this.find({ status });
  }

  getAll(): GenerationJob[] {
    return Array.from(this.jobs.values());
  }

  clear(): void {
    this.jobs.clear();
  }

  count(): number {
    return this.jobs.size;
  }
}

export const createGenerationJobRepository = (): GenerationJobRepository => {
  return new GenerationJobRepository();
};
