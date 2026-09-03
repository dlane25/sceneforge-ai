import { describe, expect, it } from 'vitest';
import { MockVideoProvider } from '@/lib/video/mock-provider';

const input = {
  prompt: 'Marcus enters the Sterling penthouse at night.',
  duration: 6,
  aspectRatio: '9:16' as const,
  style: 'cinematic',
};

describe('MockVideoProvider', () => {
  it('calculates deterministic costs and input hashes', async () => {
    const first = new MockVideoProvider();
    const second = new MockVideoProvider();
    const firstJob = await first.generateShot(input);
    const secondJob = await second.generateShot(input);

    expect(firstJob.inputHash).toBe(secondJob.inputHash);
    expect(firstJob.estimatedCost).toBe(secondJob.estimatedCost);
    expect(firstJob.provider).toBe('mock');
  });

  it('progresses a job deterministically to a mock output', async () => {
    const provider = new MockVideoProvider();
    const job = await provider.generateShot(input);
    let status = await provider.getStatus(job.id);

    while (status.status !== 'succeeded' && status.status !== 'failed') {
      status = await provider.getStatus(job.id);
    }

    expect(status.status).toBe('succeeded');
    expect(status.progress).toBe(100);
    expect(status.outputUrl).toBe(`mock://video/${job.id}.mp4`);
  });

  it('returns a failed status for an unknown job', async () => {
    const provider = new MockVideoProvider();
    await expect(provider.getStatus('missing-job')).resolves.toMatchObject({
      status: 'failed',
      errorMessage: 'Job not found',
    });
  });
});
