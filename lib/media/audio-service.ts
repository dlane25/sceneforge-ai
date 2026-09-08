import 'server-only';

import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series/service';
import type { Character, GeneratedAsset, GenerationJob, Shot, VoiceProfile } from '@/types';
import { loadGenerationConfig, type GenerationConfig } from './config';
import { consoleProviderLogger, silentProviderLogger, type ProviderLogger } from './provider-logging';
import { normalizeProviderError, providerError } from './providers/errors';
import { ProviderRegistry } from './providers/registry';
import { ProviderErrorCode, type MediaProvider, type ProviderJobStatus } from './providers/types';

interface AudioServiceOptions {
  registry?: ProviderRegistry;
  loadConfig?: () => GenerationConfig;
  logger?: ProviderLogger;
  now?: () => Date;
}

export interface SceneAudioState {
  jobs: GenerationJob[];
  assets: GeneratedAsset[];
  characters: Array<{
    id: string;
    name: string;
    voiceProfile: Pick<VoiceProfile, 'displayName' | 'provider' | 'providerVoiceId' | 'language' | 'locale' | 'active'>;
  }>;
}

const activeStatuses = ['awaiting_approval', 'approved', 'queued', 'processing'];

export class AudioGenerationService {
  private readonly production: ProductionService;
  private readonly registry: ProviderRegistry;
  private readonly configLoader: () => GenerationConfig;
  private readonly logger: ProviderLogger;
  private readonly now: () => Date;

  constructor(private readonly repository: PersistenceRepository, options: AudioServiceOptions = {}) {
    this.production = new ProductionService(repository);
    this.registry = options.registry || new ProviderRegistry();
    this.configLoader = options.loadConfig || (() => loadGenerationConfig());
    this.logger = options.logger || (process.env.NODE_ENV === 'test' ? silentProviderLogger : consoleProviderLogger);
    this.now = options.now || (() => new Date());
  }

  async prepareLine(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string, shotId: string, characterId?: string): Promise<GenerationJob> {
    const shot = await this.requireShot(user, seriesId, episodeId, sceneId, shotId);
    if (!shot.dialogue?.trim()) throw new Error('Shot dialogue is required for speech generation');
    const selectedCharacterId = characterId || shot.characterIds[0];
    if (!selectedCharacterId || !shot.characterIds.includes(selectedCharacterId)) throw new Error('A character assigned to this shot is required for speech generation');
    const character = await this.requireCharacter(user, seriesId, selectedCharacterId);
    this.assertVoiceGovernance(character.voiceProfile);

    const history = await this.repository.listGenerationJobs(seriesId, episodeId, sceneId, shotId);
    if (history.some((job) => job.generationType === 'audio' && activeStatuses.includes(job.status))) throw new Error('An active audio generation job already exists for this dialogue line');
    const config = this.configLoader();
    const provider = this.registry.resolve(config.audioProvider, config.providers[config.audioProvider]);
    if (!provider.capabilities.textToSpeech) throw providerError(ProviderErrorCode.UnsupportedCapability, `Configured provider ${provider.id} does not support text-to-speech`);
    if (provider.id !== 'mock' && character.voiceProfile.provider !== provider.id) throw new Error('Character voice profile does not match the configured audio provider');
    const voiceId = character.voiceProfile.providerVoiceId || (provider.id === 'mock' ? `mock-${character.id}` : undefined);
    if (!voiceId) throw new Error('Character voice profile requires a provider voice ID');
    const providerConfig = config.providers[config.audioProvider];
    const model = providerConfig.audioModel || provider.capabilities.supportedModels?.[0] || 'mock-v1';
    const language = character.voiceProfile.language || config.defaultAudioLanguage;
    const request = this.requestFor(shot.dialogue, character.voiceProfile, voiceId, model, language, providerConfig.outputFormat);
    const estimatedCost = await provider.estimateCost(request);
    const now = this.now();
    const generationParameters = {
      characterId: character.id, voiceDisplayName: character.voiceProfile.displayName || character.name, providerVoiceId: voiceId,
      language, locale: character.voiceProfile.locale, pace: character.voiceProfile.pace, tone: character.voiceProfile.tone,
      stability: character.voiceProfile.stability, similarityBoost: character.voiceProfile.similarityBoost,
      styleExaggeration: character.voiceProfile.styleExaggeration, speakerBoost: character.voiceProfile.speakerBoost,
      outputFormat: request.outputFormat, model,
    };
    const inputHash = createHash('sha256').update(JSON.stringify({ text: shot.dialogue, generationParameters })).digest('hex');
    const audioHistory = history.filter((job) => job.generationType === 'audio');
    return this.repository.createGenerationJob({
      id: `audio_${shotId}_${audioHistory.length + 1}`, seriesId, episodeId, sceneId, shotId,
      provider: provider.id, providerModel: model, providerVoiceId: voiceId, characterId: character.id, language, locale: character.voiceProfile.locale,
      generationType: 'audio', status: 'awaiting_approval', promptVersion: '1.0', inputHash,
      promptSnapshot: shot.dialogue, generationParameters, durationSeconds: this.estimateDuration(shot.dialogue, character.voiceProfile.pace), aspectRatio: '1:1',
      estimatedCost, actualCost: 0, retryCount: 0, outputAssetIds: [], createdAt: now, updatedAt: now,
    });
  }

  async prepareScene(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string): Promise<GenerationJob[]> {
    const shots = await this.production.listShots(user, seriesId, episodeId, sceneId);
    const candidates = shots.filter((shot) => shot.dialogue?.trim() && shot.characterIds.length);
    if (!candidates.length) throw new Error('Scene has no character dialogue available for speech generation');
    const created: GenerationJob[] = [];
    for (const shot of candidates) {
      const history = await this.repository.listGenerationJobs(seriesId, episodeId, sceneId, shot.id);
      if (history.some((job) => job.generationType === 'audio' && activeStatuses.includes(job.status))) continue;
      created.push(await this.prepareLine(user, seriesId, episodeId, sceneId, shot.id));
    }
    return created;
  }

  async listScene(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string): Promise<SceneAudioState> {
    const [shots, characters] = await Promise.all([this.production.listShots(user, seriesId, episodeId, sceneId), this.production.listCharacters(user, seriesId)]);
    const groups = await Promise.all(shots.map(async (shot) => ({ jobs: await this.repository.listGenerationJobs(seriesId, episodeId, sceneId, shot.id), assets: await this.repository.listGeneratedAssets(seriesId, episodeId, sceneId, shot.id) })));
    return {
      jobs: groups.flatMap((group) => group.jobs).filter((job) => job.generationType === 'audio'),
      assets: groups.flatMap((group) => group.assets).filter((asset) => asset.assetType === 'audio'),
      characters: characters.map((character) => ({
        id: character.id,
        name: character.name,
        voiceProfile: {
          displayName: character.voiceProfile.displayName,
          provider: character.voiceProfile.provider,
          providerVoiceId: character.voiceProfile.providerVoiceId,
          language: character.voiceProfile.language,
          locale: character.voiceProfile.locale,
          active: character.voiceProfile.active,
        },
      })),
    };
  }

  async approve(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> { const job = await this.requireJob(user, ids, jobId, 'OWNER'); if (job.status !== 'awaiting_approval') throw new Error('Audio job is not awaiting approval'); return this.save(job, { status: 'approved' }); }
  async reject(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> { const job = await this.requireJob(user, ids, jobId, 'OWNER'); if (job.status !== 'awaiting_approval') throw new Error('Audio job is not awaiting approval'); return this.save(job, { status: 'rejected' }); }

  async start(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (job.status !== 'approved') throw new Error('Human approval is required before speech generation');
    const started = Date.now();
    try {
      const provider = this.resolveJobProvider(job);
      const result = await provider.generateSpeech({
        type: 'audio', prompt: job.promptSnapshot, voiceId: job.providerVoiceId, model: job.providerModel, language: job.language, locale: job.locale,
        stability: this.numberParameter(job, 'stability'), similarityBoost: this.numberParameter(job, 'similarityBoost'), styleExaggeration: this.numberParameter(job, 'styleExaggeration'),
        speakerBoost: typeof job.generationParameters?.speakerBoost === 'boolean' ? job.generationParameters.speakerBoost : undefined,
        outputFormat: typeof job.generationParameters?.outputFormat === 'string' ? job.generationParameters.outputFormat : undefined,
      });
      this.logger.write({ operation: 'submit', provider: job.provider, model: result.model, voiceId: job.providerVoiceId, generationJobId: job.id, providerJobId: result.jobId, status: result.status, durationMs: Date.now() - started });
      const submittedAt = result.submittedAt || this.now();
      if (result.status === 'failed' || result.status === 'cancelled') {
        const normalized = normalizeProviderError(providerError(result.status === 'cancelled' ? ProviderErrorCode.Cancelled : ProviderErrorCode.ProviderUnavailable, result.status === 'cancelled' ? 'Provider operation was cancelled' : 'Provider operation failed', result.status === 'failed'));
        return this.save(job, { status: result.status, providerJobId: result.jobId, providerModel: result.model, submittedAt, startedAt: submittedAt, lastProviderStatus: result.status, providerMetadata: result.lifecycleMetadata, errorCode: normalized.code, errorMessage: normalized.message, retryable: normalized.retryable, lastProviderError: `${normalized.code}: ${normalized.message}`, failedAt: result.status === 'failed' ? this.now() : undefined, cancelledAt: result.status === 'cancelled' ? this.now() : undefined });
      }
      const submitted = await this.save(job, { status: result.status === 'succeeded' ? 'processing' : result.status, providerJobId: result.jobId, providerModel: result.model, submittedAt, startedAt: submittedAt, lastProviderStatus: result.status, providerMetadata: result.lifecycleMetadata });
      return result.status === 'succeeded' ? this.complete(submitted, { jobId: result.jobId, status: 'succeeded', output: result.output, actualCost: result.actualCost, lastUpdated: this.now(), lifecycleMetadata: result.lifecycleMetadata }) : submitted;
    } catch (error) {
      const normalized = normalizeProviderError(error);
      this.logger.write({ operation: 'submit', provider: job.provider, model: job.providerModel, voiceId: job.providerVoiceId, generationJobId: job.id, status: 'failed', durationMs: Date.now() - started, error: normalized });
      return this.save(job, { status: 'failed', errorCode: normalized.code, errorMessage: normalized.message, retryable: normalized.retryable, lastProviderError: `${normalized.code}: ${normalized.message}`, lastProviderStatus: 'failed', failedAt: this.now() });
    }
  }

  async refresh(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'VIEWER');
    if (['completed', 'failed', 'cancelled', 'rejected'].includes(job.status) || !job.providerJobId) return job;
    const started = Date.now();
    try {
      const status = await this.resolveJobProvider(job).getStatus(job.providerJobId);
      this.logger.write({ operation: 'poll', provider: job.provider, model: job.providerModel, voiceId: job.providerVoiceId, generationJobId: job.id, providerJobId: job.providerJobId, status: status.status, durationMs: Date.now() - started, error: status.error });
      if (status.status === 'succeeded') return this.complete(job, status);
      const now = this.now();
      if (status.status === 'failed' || status.status === 'cancelled') {
        const error = status.error || normalizeProviderError(providerError(status.status === 'cancelled' ? ProviderErrorCode.Cancelled : ProviderErrorCode.UnknownError, status.status === 'cancelled' ? 'Provider operation was cancelled' : 'Provider operation failed'));
        return this.save(job, { status: status.status, errorCode: error.code, errorMessage: error.message, retryable: error.retryable, lastProviderError: `${error.code}: ${error.message}`, lastProviderStatus: status.status, lastPolledAt: now, failedAt: status.status === 'failed' ? now : undefined, cancelledAt: status.status === 'cancelled' ? now : undefined });
      }
      return this.save(job, { status: status.status, lastProviderStatus: status.status, lastPolledAt: now, lastProviderError: undefined });
    } catch (error) {
      const normalized = normalizeProviderError(error);
      this.logger.write({ operation: 'poll', provider: job.provider, model: job.providerModel, voiceId: job.providerVoiceId, generationJobId: job.id, providerJobId: job.providerJobId, status: 'polling_error', durationMs: Date.now() - started, error: normalized });
      return this.save(job, { lastPolledAt: this.now(), lastProviderStatus: 'polling_error', errorCode: normalized.code, errorMessage: normalized.message, retryable: normalized.retryable, lastProviderError: `${normalized.code}: ${normalized.message}` });
    }
  }

  async cancel(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (['completed', 'failed', 'cancelled', 'rejected'].includes(job.status)) return job;
    if (!job.providerJobId) return this.save(job, { status: 'cancelled', cancelledAt: this.now(), lastProviderStatus: 'cancelled' });
    const started = Date.now();
    const provider = this.resolveJobProvider(job);
    if (!provider.capabilities.cancellation) { const error = normalizeProviderError(providerError(ProviderErrorCode.UnsupportedCapability, `${provider.id} does not support cancellation`)); this.logger.write({ operation: 'cancel', provider: job.provider, model: job.providerModel, voiceId: job.providerVoiceId, generationJobId: job.id, providerJobId: job.providerJobId, durationMs: Date.now() - started, error }); return this.save(job, { errorCode: error.code, errorMessage: error.message, retryable: false, lastProviderError: `${error.code}: ${error.message}` }); }
    try {
      const status = await provider.cancelJob(job.providerJobId);
      this.logger.write({ operation: 'cancel', provider: job.provider, model: job.providerModel, voiceId: job.providerVoiceId, generationJobId: job.id, providerJobId: job.providerJobId, status: status.status, durationMs: Date.now() - started, error: status.error });
      return this.save(job, { status: status.status === 'cancelled' ? 'cancelled' : job.status, cancelledAt: status.status === 'cancelled' ? this.now() : undefined, lastProviderStatus: status.status });
    } catch (cause) {
      const error = normalizeProviderError(cause);
      this.logger.write({ operation: 'cancel', provider: job.provider, model: job.providerModel, voiceId: job.providerVoiceId, generationJobId: job.id, providerJobId: job.providerJobId, durationMs: Date.now() - started, error });
      return this.save(job, { errorCode: error.code, errorMessage: error.message, retryable: error.retryable, lastProviderError: `${error.code}: ${error.message}` });
    }
  }

  async retry(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (!['failed', 'cancelled'].includes(job.status)) throw new Error('Only failed or cancelled audio jobs can be retried');
    if (job.retryCount >= 3) throw new Error('Maximum retry count reached');
    const now = this.now();
    return this.repository.createGenerationJob({ ...job, id: `${job.id}_retry_${job.retryCount + 1}`, status: 'awaiting_approval', providerJobId: undefined, retryCount: job.retryCount + 1, outputAssetIds: [], actualCost: 0, errorCode: undefined, errorMessage: undefined, retryable: undefined, lastProviderStatus: undefined, lastProviderError: undefined, providerMetadata: undefined, completionMetadata: undefined, startedAt: undefined, submittedAt: undefined, completedAt: undefined, failedAt: undefined, cancelledAt: undefined, createdAt: now, updatedAt: now });
  }

  private assertVoiceGovernance(profile: VoiceProfile): void {
    if (profile.active === false) throw new Error('Character voice profile is inactive');
    const hasReference = !!profile.reference && Object.values(profile.reference).some((value) => value !== undefined && value !== '');
    const sourceType = profile.rights?.sourceType;
    if (hasReference && !profile.rights) throw new Error('Voice rights and consent metadata is required for a reference voice');
    if (hasReference || sourceType === 'cloned' || sourceType === 'uploaded-reference' || sourceType === 'licensed') {
      if (!profile.rights?.rightsConfirmed || !profile.rights.consentConfirmed || profile.rights.approvalState !== 'approved' || !profile.rights.confirmedAt) throw new Error('Voice rights and consent must be confirmed and approved before generation');
    }
  }

  private requestFor(text: string, profile: VoiceProfile, voiceId: string, model: string, language: string, outputFormat?: string) {
    return { type: 'audio' as const, prompt: text, voiceId, model, language, locale: profile.locale, stability: profile.stability, similarityBoost: profile.similarityBoost, styleExaggeration: profile.styleExaggeration, speakerBoost: profile.speakerBoost, outputFormat: outputFormat || 'mp3_44100_128' };
  }

  private estimateDuration(text: string, pace: VoiceProfile['pace']): number { const wordsPerSecond = pace === 'slow' ? 1.8 : pace === 'fast' ? 3.2 : 2.5; return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / wordsPerSecond)); }
  private numberParameter(job: GenerationJob, key: string): number | undefined { const value = job.generationParameters?.[key]; return typeof value === 'number' ? value : undefined; }
  private resolveJobProvider(job: GenerationJob): MediaProvider { const config = this.configLoader(); const providerConfig = config.providers[job.provider as keyof typeof config.providers]; if (!providerConfig) throw new Error(`Provider ${job.provider} is not configured`); return this.registry.resolve(job.provider, providerConfig); }
  private async requireShot(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string, shotId: string): Promise<Shot> { const shot = (await this.production.listShots(user, seriesId, episodeId, sceneId)).find((value) => value.id === shotId); if (!shot) throw new Error(`Shot ${shotId} was not found`); return shot; }
  private async requireCharacter(user: AuthenticatedUser, seriesId: string, characterId: string): Promise<Character> { const character = (await this.production.listCharacters(user, seriesId)).find((value) => value.id === characterId); if (!character) throw new Error(`Character ${characterId} was not found`); return character; }
  private async requireJob(user: AuthenticatedUser, ids: string[], jobId: string, role: 'OWNER' | 'VIEWER'): Promise<GenerationJob> { await this.production.authorizeMediaOperation(user, ids[0], role); const shots = await this.production.listShots(user, ids[0], ids[1], ids[2]); for (const shot of shots) { const job = (await this.repository.listGenerationJobs(ids[0], ids[1], ids[2], shot.id)).find((candidate) => candidate.id === jobId && candidate.generationType === 'audio'); if (job) return job; } throw new Error(`Audio generation job ${jobId} was not found`); }
  private async save(job: GenerationJob, changes: Partial<GenerationJob>): Promise<GenerationJob> { return this.repository.updateGenerationJob({ ...job, ...changes, updatedAt: this.now() }); }

  private async complete(job: GenerationJob, status: ProviderJobStatus): Promise<GenerationJob> {
    const now = this.now();
    if (!status.output) return this.save(job, { status: 'failed', errorCode: ProviderErrorCode.ProviderUnavailable, errorMessage: 'Provider completed without normalized audio output', retryable: true, failedAt: now, lastPolledAt: now, lastProviderStatus: 'failed' });
    const existing = await this.repository.listGeneratedAssets(job.seriesId, job.episodeId, job.sceneId, job.shotId);
    const audioAssets = existing.filter((asset) => asset.assetType === 'audio');
    const prior = audioAssets.find((asset) => asset.generationJobId === job.id);
    const version = audioAssets.reduce((maximum, asset) => Math.max(maximum, asset.version), 0) + 1;
    const latest = [...audioAssets].sort((a, b) => b.version - a.version)[0];
    const asset = prior || await this.repository.createGeneratedAsset({
      id: `asset_${job.id}`, generationJobId: job.id, seriesId: job.seriesId, episodeId: job.episodeId, sceneId: job.sceneId, shotId: job.shotId,
      assetType: 'audio', uri: status.output.uri, storageUri: status.output.storageUri, mimeType: status.output.mimeType, width: 0, height: 0,
      durationSeconds: status.output.durationSeconds || job.durationSeconds, fileSize: status.output.fileSize, provider: job.provider, providerJobId: job.providerJobId,
      providerModel: job.providerModel, providerVoiceId: job.providerVoiceId, characterId: job.characterId, language: job.language, locale: job.locale,
      sourceTextSnapshot: job.promptSnapshot, codec: status.output.codec, sampleRate: status.output.sampleRate, bitrate: status.output.bitrate, channels: status.output.channels,
      fingerprint: job.inputHash, checksum: status.output.checksum, generationParameters: job.generationParameters, promptSnapshot: job.promptSnapshot,
      costMetadata: { estimatedCost: job.estimatedCost, actualCost: status.actualCost ?? job.actualCost, currency: 'USD' }, version, parentAssetId: latest?.id,
      preferred: false, reviewStatus: 'pending', createdAt: now, updatedAt: now,
    });
    this.logger.write({ operation: 'complete', provider: job.provider, model: job.providerModel, voiceId: job.providerVoiceId, generationJobId: job.id, providerJobId: job.providerJobId, status: 'succeeded' });
    return this.save(job, { status: 'completed', actualCost: status.actualCost ?? job.actualCost, outputAssetIds: [asset.id], lastPolledAt: now, lastProviderStatus: 'succeeded', lastProviderError: undefined, errorCode: undefined, errorMessage: undefined, retryable: undefined, completedAt: now, completionMetadata: { ...status.lifecycleMetadata, outputMimeType: status.output.mimeType, codec: status.output.codec, sampleRate: status.output.sampleRate, bitrate: status.output.bitrate, channels: status.output.channels, checksum: status.output.checksum } });
  }
}
