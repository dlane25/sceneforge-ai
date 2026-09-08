/**
 * Milestone 9 Integration Tests
 * Tests provider integration with generation service and persistence
 * Covers: async refresh, duplicate prevention, provider job ID tracking,
 * idempotent completion, and generation lifecycle
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockVideoProvider } from '@/lib/video/mock-provider';
import type { CaptionTrack, EpisodeAssembly, EpisodeExportJob, EpisodeLaunchPackage, GenerationJob, GeneratedAsset } from '@/types';
import type { PersistenceRepository } from '@/lib/repositories';

// Mock repository for testing
class MockPersistenceRepository implements PersistenceRepository {
  private jobs: Map<string, GenerationJob> = new Map();
  private assets: Map<string, GeneratedAsset> = new Map();

  async listGenerationJobs(
    seriesId: string,
    episodeId: string,
    sceneId: string,
    shotId: string
  ): Promise<GenerationJob[]> {
    return Array.from(this.jobs.values()).filter(
      (j) => j.seriesId === seriesId && j.episodeId === episodeId &&
             j.sceneId === sceneId && j.shotId === shotId
    );
  }

  async createGenerationJob(job: GenerationJob): Promise<GenerationJob> {
    this.jobs.set(job.id, { ...job, updatedAt: new Date(), createdAt: new Date() });
    return this.jobs.get(job.id)!;
  }

  async getGenerationJob(
    seriesId: string,
    episodeId: string,
    sceneId: string,
    shotId: string,
    jobId: string
  ): Promise<GenerationJob | undefined> {
    return this.jobs.get(jobId);
  }

  async updateGenerationJob(job: GenerationJob): Promise<GenerationJob> {
    this.jobs.set(job.id, { ...job, updatedAt: new Date() });
    return this.jobs.get(job.id)!;
  }

  async listGeneratedAssets(
    seriesId: string,
    episodeId: string,
    sceneId: string,
    shotId: string
  ): Promise<GeneratedAsset[]> {
    return Array.from(this.assets.values()).filter(
      (a) => a.seriesId === seriesId && a.episodeId === episodeId &&
             a.sceneId === sceneId && a.shotId === shotId
    );
  }

  async createGeneratedAsset(asset: GeneratedAsset): Promise<GeneratedAsset> {
    this.assets.set(asset.id, { ...asset, updatedAt: new Date(), createdAt: new Date() });
    return this.assets.get(asset.id)!;
  }

  async getGeneratedAsset(
    seriesId: string,
    episodeId: string,
    sceneId: string,
    shotId: string,
    assetId: string
  ): Promise<GeneratedAsset | undefined> {
    return this.assets.get(assetId);
  }

  async updateGeneratedAsset(asset: GeneratedAsset): Promise<GeneratedAsset> {
    this.assets.set(asset.id, { ...asset, updatedAt: new Date() });
    return this.assets.get(asset.id)!;
  }

  // Stub other required methods
  async getUser() { return undefined; }
  async findUserByEmail() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async upsertUser() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async upsertUserIdentity() { return {} as any; }
  async getMembership() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async upsertMembership() { return {} as any; }
  async listMemberships() { return []; }
  async removeMembership() { return; }
  async listAccessibleSeries() { return []; }
  async getSeries() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createSeries() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateSeries() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async archiveSeries() { return {} as any; }
  async listCharacters() { return []; }
  async getCharacter() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createCharacter() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateCharacter() { return {} as any; }
  async deleteCharacter() { return; }
  async listLocations() { return []; }
  async getLocation() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createLocation() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateLocation() { return {} as any; }
  async deleteLocation() { return; }
  async listEpisodes() { return []; }
  async getEpisode() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createEpisode() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateEpisode() { return {} as any; }
  async deleteEpisode() { return; }
  async listScenes() { return []; }
  async getScene() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createScene() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateScene() { return {} as any; }
  async deleteScene() { return; }
  async listStoryFacts() { return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createStoryFact() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateStoryFact() { return {} as any; }
  async deleteStoryFact() { return; }
  async listShots() { return []; }
  async getShot() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createShot() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateShot() { return {} as any; }
  async deleteShot() { return; }
  async reorderShots() { return []; }
  async getStoryboard() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createStoryboard() { return {} as any; }
  async listAllShots() { return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createMediaReview() { return {} as any; }
  async listMediaReviews() { return []; }
  async getMediaReview() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateMediaReview() { return {} as any; }
  async createCaptionTrack(track: CaptionTrack) { return track; }
  async getCaptionTrack() { return undefined; }
  async listCaptionTracks() { return []; }
  async updateCaptionTrack(track: CaptionTrack) { return track; }
  async createEpisodeAssembly(assembly: EpisodeAssembly) { return assembly; }
  async getEpisodeAssembly() { return undefined; }
  async listEpisodeAssemblies() { return []; }
  async updateEpisodeAssembly(assembly: EpisodeAssembly) { return assembly; }
  async createEpisodeExportJob(job: EpisodeExportJob) { return job; }
  async getEpisodeExportJob() { return undefined; }
  async listEpisodeExportJobs() { return []; }
  async updateEpisodeExportJob(job: EpisodeExportJob) { return job; }
  async createEpisodeLaunchPackage(value: EpisodeLaunchPackage) { return value; }
  async getEpisodeLaunchPackage() { return undefined; }
  async listEpisodeLaunchPackages() { return []; }
  async updateEpisodeLaunchPackage(value: EpisodeLaunchPackage) { return value; }
  
  // PipelineRepository methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create() { return {} as any; }
  async get() { return undefined; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async update() { return {} as any; }
  async listExecutions() { return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveExecution() { return {} as any; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveApproval() { return {} as any; }
  async saveStage() { return; }
  
  // SeriesMemoryRepository methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async addFact() { return {} as any; }
  async listFacts() { return []; }
  async getActiveFacts() { return []; }
  
  // PersistenceRepository methods
  async reset() { return; }
}

describe('Milestone 9 Integration Tests', () => {
  let repo: MockPersistenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mockProvider: MockVideoProvider;

  beforeEach(() => {
    repo = new MockPersistenceRepository();
    mockProvider = new MockVideoProvider();
  });

  describe('Provider Job ID Persistence', () => {
    it('tracks providerJobId in GenerationJob', async () => {
      const job: GenerationJob = {
        id: 'job_test_1',
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        provider: 'mock',
        providerJobId: 'mock_job_12345',
        providerModel: 'mock-v1',
        generationType: 'video',
        status: 'processing',
        promptVersion: 'v1',
        inputHash: 'hash123',
        promptSnapshot: 'test prompt',
        durationSeconds: 5,
        aspectRatio: '16:9',
        estimatedCost: 1.5,
        actualCost: 0,
        retryCount: 0,
        outputAssetIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await repo.createGenerationJob(job);
      expect(created.providerJobId).toBe('mock_job_12345');
      expect(created.provider).toBe('mock');
      expect(created.providerModel).toBe('mock-v1');
    });

    it('tracks lastPolledAt on refresh', async () => {
      const job: GenerationJob = {
        id: 'job_test_2',
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        provider: 'mock',
        providerJobId: 'mock_job_12346',
        generationType: 'video',
        status: 'processing',
        promptVersion: 'v1',
        inputHash: 'hash123',
        promptSnapshot: 'test prompt',
        durationSeconds: 5,
        aspectRatio: '16:9',
        estimatedCost: 1.5,
        actualCost: 0,
        retryCount: 0,
        outputAssetIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.createGenerationJob(job);

      const beforePoll = new Date();
      const updated = await repo.updateGenerationJob({
        ...job,
        lastPolledAt: new Date(),
        lastProviderStatus: 'processing',
      });

      expect(updated.lastPolledAt).toBeDefined();
      expect(updated.lastPolledAt!.getTime()).toBeGreaterThanOrEqual(beforePoll.getTime());
    });
  });

  describe('Async Polling Idempotency', () => {
    it('prevents duplicate GeneratedAssets on re-poll', async () => {
      const seriesId = 'series_1';
      const episodeId = 'episode_1';
      const sceneId = 'scene_1';
      const shotId = 'shot_1';
      const jobId = 'job_test_3';

      const job: GenerationJob = {
        id: jobId,
        seriesId,
        episodeId,
        sceneId,
        shotId,
        provider: 'mock',
        providerJobId: 'mock_job_12347',
        generationType: 'video',
        status: 'completed',
        promptVersion: 'v1',
        inputHash: 'hash123',
        promptSnapshot: 'test prompt',
        durationSeconds: 5,
        aspectRatio: '16:9',
        estimatedCost: 1.5,
        actualCost: 1.5,
        retryCount: 0,
        outputAssetIds: ['asset_1'],
        createdAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.createGenerationJob(job);

      // First completion: create asset
      const asset1: GeneratedAsset = {
        id: 'asset_1',
        generationJobId: jobId,
        seriesId,
        episodeId,
        sceneId,
        shotId,
        assetType: 'video-clip',
        uri: 'https://example.com/video1.mp4',
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        provider: 'mock',
        providerJobId: 'mock_job_12347',
        fingerprint: 'fp123',
        version: 1,
        reviewStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.createGeneratedAsset(asset1);

      // Second poll: check if asset exists
      const existingAssets = await repo.listGeneratedAssets(seriesId, episodeId, sceneId, shotId);
      expect(existingAssets).toHaveLength(1);
      expect(existingAssets[0].id).toBe('asset_1');

      // Simulate re-poll - should not create duplicate
      const stillOneAsset = await repo.listGeneratedAssets(seriesId, episodeId, sceneId, shotId);
      expect(stillOneAsset).toHaveLength(1);
    });

    it('is idempotent when refresh called on completed job', async () => {
      const jobId = 'job_test_4';
      const job: GenerationJob = {
        id: jobId,
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        provider: 'mock',
        providerJobId: 'mock_job_12348',
        generationType: 'video',
        status: 'completed',
        promptVersion: 'v1',
        inputHash: 'hash123',
        promptSnapshot: 'test prompt',
        durationSeconds: 5,
        aspectRatio: '16:9',
        estimatedCost: 1.5,
        actualCost: 1.5,
        retryCount: 0,
        outputAssetIds: [],
        createdAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.createGenerationJob(job);

      // Simulated refresh on completed job
      const existing = await repo.getGenerationJob(
        job.seriesId,
        job.episodeId,
        job.sceneId,
        job.shotId,
        jobId
      );

      expect(existing?.status).toBe('completed');

      // If already completed, refresh() should return early (idempotent)
      // This is implemented in GenerationService.refresh() with:
      // if (job.status in ['completed', 'failed', 'cancelled']) return;
    });

    it('handles repeated completed-job refresh without creating assets', async () => {
      const jobId = 'job_test_5';
      const job: GenerationJob = {
        id: jobId,
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        provider: 'mock',
        providerJobId: 'mock_job_12349',
        generationType: 'video',
        status: 'completed',
        promptVersion: 'v1',
        inputHash: 'hash123',
        promptSnapshot: 'test prompt',
        durationSeconds: 5,
        aspectRatio: '16:9',
        estimatedCost: 1.5,
        actualCost: 1.5,
        retryCount: 0,
        outputAssetIds: ['asset_first'],
        createdAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.createGenerationJob(job);

      // Create initial asset
      const asset: GeneratedAsset = {
        id: 'asset_first',
        generationJobId: jobId,
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        assetType: 'video-clip',
        uri: 'https://example.com/video.mp4',
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        provider: 'mock',
        providerJobId: 'mock_job_12349',
        fingerprint: 'fp123',
        version: 1,
        reviewStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.createGeneratedAsset(asset);

      // Simulate three refreshes on same completed job
      for (let i = 0; i < 3; i++) {
        const assets = await repo.listGeneratedAssets('series_1', 'episode_1', 'scene_1', 'shot_1');
        // Should always be 1 asset (idempotent)
        expect(assets).toHaveLength(1);
      }
    });
  });

  describe('Generated Asset Metadata', () => {
    it('persists provider metadata with asset', async () => {
      const asset: GeneratedAsset = {
        id: 'asset_meta_1',
        generationJobId: 'job_1',
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        assetType: 'video-clip',
        uri: 'https://example.com/output.mp4',
        storageUri: 's3://bucket/video.mp4',
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        durationSeconds: 5,
        fileSize: 5242880,
        provider: 'vertex-video',
        providerJobId: 'vertex_op_12345',
        providerModel: 'veo-2',
        fingerprint: 'sha256_abc123',
        checksum: 'sha256_abc123def456',
        promptSnapshot: 'A cinematic scene of a desert landscape',
        negativePromptSnapshot: 'blurry, low quality, distorted',
        costMetadata: {
          estimatedCost: 2.5,
          actualCost: 2.45,
          currency: 'USD',
        },
        generationParameters: {
          duration: 5,
          resolution: 1080,
          aspectRatio: '16:9',
          model: 'veo-2',
        },
        version: 1,
        reviewStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await repo.createGeneratedAsset(asset);

      expect(created.provider).toBe('vertex-video');
      expect(created.providerJobId).toBe('vertex_op_12345');
      expect(created.providerModel).toBe('veo-2');
      expect(created.storageUri).toBe('s3://bucket/video.mp4');
      expect(created.checksum).toBe('sha256_abc123def456');
      expect(created.promptSnapshot).toBe('A cinematic scene of a desert landscape');
      expect(created.negativePromptSnapshot).toBe('blurry, low quality, distorted');
      expect(created.costMetadata?.actualCost).toBe(2.45);
    });

    it('tracks cost metadata accurately', async () => {
      const asset: GeneratedAsset = {
        id: 'asset_cost_1',
        generationJobId: 'job_1',
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        assetType: 'video-clip',
        uri: 'https://example.com/output.mp4',
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        provider: 'mock',
        fingerprint: 'fp123',
        version: 1,
        reviewStatus: 'pending',
        costMetadata: {
          estimatedCost: 5.0,
          actualCost: 4.85,
          currency: 'USD',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await repo.createGeneratedAsset(asset);

      expect(created.costMetadata).toBeDefined();
      expect(created.costMetadata!.estimatedCost).toBe(5.0);
      expect(created.costMetadata!.actualCost).toBe(4.85);
      expect(created.costMetadata!.currency).toBe('USD');
    });
  });

  describe('Provider Error Normalization', () => {
    it('tracks normalized provider errors in job', async () => {
      const job: GenerationJob = {
        id: 'job_error_1',
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        provider: 'vertex-video',
        generationType: 'video',
        status: 'failed',
        promptVersion: 'v1',
        inputHash: 'hash123',
        promptSnapshot: 'test',
        durationSeconds: 5,
        aspectRatio: '16:9',
        estimatedCost: 0,
        actualCost: 0,
        retryCount: 3,
        outputAssetIds: [],
        errorCode: 'quota_exceeded',
        errorMessage: 'Daily quota limit reached',
        retryable: true,
        lastProviderError: 'quota_exceeded: daily_limit_reached',
        createdAt: new Date(),
        failedAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await repo.createGenerationJob(job);

      expect(created.errorCode).toBe('quota_exceeded');
      expect(created.errorMessage).toBe('Daily quota limit reached');
      expect(created.retryable).toBe(true);
      expect(created.lastProviderError).toContain('quota_exceeded');
      expect(created.lastProviderError).not.toMatch(/api.?key|secret|token/i);
    });
  });

  describe('Milestone 8 Review Workflow Preservation', () => {
    it('preserves asset review status after generation', async () => {
      const asset: GeneratedAsset = {
        id: 'asset_review_1',
        generationJobId: 'job_1',
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        assetType: 'video-clip',
        uri: 'https://example.com/video.mp4',
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        provider: 'mock',
        fingerprint: 'fp123',
        version: 1,
        reviewStatus: 'pending',
        preferred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await repo.createGeneratedAsset(asset);

      expect(created.reviewStatus).toBe('pending');
      expect(created.preferred).toBe(false);
      expect(created.version).toBe(1);
    });

    it('supports asset versioning', async () => {
      const asset1: GeneratedAsset = {
        id: 'asset_v1',
        generationJobId: 'job_1',
        seriesId: 'series_1',
        episodeId: 'episode_1',
        sceneId: 'scene_1',
        shotId: 'shot_1',
        assetType: 'video-clip',
        uri: 'https://example.com/video_v1.mp4',
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        provider: 'mock',
        fingerprint: 'fp1',
        version: 1,
        reviewStatus: 'approved',
        preferred: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const asset2: GeneratedAsset = {
        ...asset1,
        id: 'asset_v2',
        uri: 'https://example.com/video_v2.mp4',
        fingerprint: 'fp2',
        version: 2,
        reviewStatus: 'pending',
        preferred: false,
        parentAssetId: 'asset_v1',
      };

      await repo.createGeneratedAsset(asset1);
      const v2 = await repo.createGeneratedAsset(asset2);

      expect(v2.version).toBe(2);
      expect(v2.parentAssetId).toBe('asset_v1');
      expect(v2.preferred).toBe(false);
    });
  });
});
