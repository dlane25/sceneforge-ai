import 'server-only';

import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { CaptionTrack, EpisodeAssembly, EpisodeTimelineItem, GeneratedAsset } from '@/types';
import { getExportPreset } from '@/lib/export/presets';
import { stableExportSerialize } from '@/lib/export/mock-engine';
import { consoleExportLogger, silentExportLogger, type ExportLogger } from '@/lib/export/logging';
import { validateAssemblyTimeline } from './validation';

interface AssemblyServiceOptions { now?: () => Date; logger?: ExportLogger }

export class EpisodeAssemblyService {
  private readonly production: ProductionService;
  private readonly now: () => Date;
  private readonly logger: ExportLogger;
  constructor(private readonly repository: PersistenceRepository, options: AssemblyServiceOptions = {}) { this.production = new ProductionService(repository); this.now = options.now || (() => new Date()); this.logger = options.logger || (process.env.NODE_ENV === 'test' ? silentExportLogger : consoleExportLogger); }

  async list(user: AuthenticatedUser, seriesId: string, episodeId: string): Promise<EpisodeAssembly[]> { await this.requireEpisode(user, seriesId, episodeId, 'VIEWER'); return this.repository.listEpisodeAssemblies(seriesId, episodeId); }
  async get(user: AuthenticatedUser, seriesId: string, episodeId: string, assemblyId: string): Promise<EpisodeAssembly> { await this.requireEpisode(user, seriesId, episodeId, 'VIEWER'); return this.requireAssembly(seriesId, episodeId, assemblyId); }

  async build(user: AuthenticatedUser, seriesId: string, episodeId: string, rebuiltFromAssemblyId?: string): Promise<EpisodeAssembly> {
    const started = Date.now(); await this.requireEpisode(user, seriesId, episodeId, 'VIEWER');
    const scenes = [...await this.production.listScenes(user, seriesId, episodeId)].sort((a, b) => a.sceneNumber - b.sceneNumber);
    const captions = await this.repository.listCaptionTracks(seriesId, episodeId);
    const caption = this.selectCaption(captions);
    const existing = await this.repository.listEpisodeAssemblies(seriesId, episodeId);
    const version = existing.reduce((maximum, assembly) => Math.max(maximum, assembly.version), 0) + 1;
    const assemblyId = `assembly_${episodeId}_v${version}`;
    const preset = getExportPreset('vertical-social-1080p'); const now = this.now(); const items: EpisodeTimelineItem[] = []; const assets = new Map<string, GeneratedAsset>(); let cursor = 0;
    for (const scene of scenes) {
      for (const shot of [...await this.production.listShots(user, seriesId, episodeId, scene.id)].sort((a, b) => a.shotNumber - b.shotNumber)) {
        const candidates = await this.repository.listGeneratedAssets(seriesId, episodeId, scene.id, shot.id);
        candidates.forEach((asset) => assets.set(asset.id, asset));
        const video = this.selectAsset(candidates, 'video-clip'); const audio = this.selectAsset(candidates, 'audio');
        const sourceVideoDurationMs = video.asset?.durationSeconds ? Math.round(video.asset.durationSeconds * 1000) : undefined;
        const durationMs = sourceVideoDurationMs || Math.round(shot.durationSeconds * 1000);
        items.push({
          id: `${assemblyId}_item_${items.length + 1}`, assemblyId, sequence: items.length + 1, sceneId: scene.id, shotId: shot.id,
          videoAssetId: video.asset?.id, audioAssetId: audio.asset?.id, videoSelectionReason: video.reason, audioSelectionReason: audio.reason,
          startMs: cursor, endMs: cursor + durationMs, sourceVideoDurationMs, sourceAudioDurationMs: audio.asset?.durationSeconds ? Math.round(audio.asset.durationSeconds * 1000) : undefined,
          trimInMs: 0, trimOutMs: 0, transitionType: 'cut', transitionDurationMs: 0, volume: 1, muted: false,
          videoAudioPolicy: 'discard', dialogueRequired: !!shot.dialogue?.trim(), createdAt: now, updatedAt: now,
        }); cursor += durationMs;
      }
    }
    const draft: EpisodeAssembly = {
      id: assemblyId, seriesId, episodeId, items, captionTrackId: caption?.id, captionIncluded: !!caption, timelineDurationMs: cursor,
      aspectRatio: preset.aspectRatio, width: preset.width, height: preset.height, frameRate: preset.frameRate, exportPreset: preset.id,
      status: 'draft', reviewState: 'pending', validationIssues: [], validationPassed: false, inputHash: '',
      explanation: 'Deterministic assembly from canonical scene/shot order and approved media selections.', createdBy: user.id,
      version, preferred: false, rebuiltFromAssemblyId, generatedAt: now, createdAt: now, updatedAt: now,
    };
    draft.inputHash = createHash('sha256').update(stableExportSerialize({ items: items.map(({ id, assemblyId: ignoredAssemblyId, createdAt, updatedAt, ...item }) => { void id; void ignoredAssemblyId; void createdAt; void updatedAt; return item; }), captionTrackId: draft.captionTrackId, preset: preset.id })).digest('hex');
    const duplicate = existing.find((assembly) => assembly.inputHash === draft.inputHash && assembly.status !== 'rejected');
    if (duplicate) return duplicate;
    draft.validationIssues = validateAssemblyTimeline(draft, { assets, captionTrack: caption });
    draft.validationPassed = !draft.validationIssues.some((issue) => issue.severity === 'error');
    draft.status = draft.validationPassed ? 'validated' : 'draft'; draft.validatedAt = now;
    const created = await this.repository.createEpisodeAssembly(draft);
    this.logger.write({ operation: 'assemble', seriesId, episodeId, assemblyId: created.id, assemblyVersion: created.version, preset: created.exportPreset, status: created.status === 'validated' ? 'validated' : undefined, durationMs: Date.now() - started });
    return created;
  }

  async validate(user: AuthenticatedUser, seriesId: string, episodeId: string, assemblyId: string): Promise<EpisodeAssembly> {
    const started = Date.now(); await this.requireEpisode(user, seriesId, episodeId, 'VIEWER'); const assembly = await this.requireAssembly(seriesId, episodeId, assemblyId);
    const assets = new Map<string, GeneratedAsset>();
    for (const item of assembly.items) for (const assetId of [item.videoAssetId, item.audioAssetId]) if (assetId) { const asset = await this.repository.getGeneratedAsset(seriesId, episodeId, item.sceneId, item.shotId, assetId); if (asset) assets.set(asset.id, asset); }
    const caption = assembly.captionTrackId ? await this.repository.getCaptionTrack(seriesId, episodeId, assembly.captionTrackId) : undefined;
    const validationIssues = validateAssemblyTimeline(assembly, { assets, captionTrack: caption }); const validationPassed = !validationIssues.some((issue) => issue.severity === 'error'); const now = this.now();
    const updated = await this.repository.updateEpisodeAssembly({ ...assembly, validationIssues, validationPassed, validatedAt: now, status: assembly.status === 'approved' ? 'approved' : validationPassed ? 'validated' : 'draft', updatedAt: now });
    this.logger.write({ operation: 'validate', seriesId, episodeId, assemblyId, assemblyVersion: assembly.version, preset: assembly.exportPreset, status: validationPassed ? 'validated' : undefined, durationMs: Date.now() - started }); return updated;
  }

  async approve(user: AuthenticatedUser, seriesId: string, episodeId: string, assemblyId: string, notes?: string): Promise<EpisodeAssembly> { await this.requireEpisode(user, seriesId, episodeId, 'OWNER'); const validated = await this.validate(user, seriesId, episodeId, assemblyId); if (!validated.validationPassed) throw new Error('Assembly validation must pass before approval'); const now = this.now(); const value = await this.repository.updateEpisodeAssembly({ ...validated, status: 'approved', reviewState: 'approved', reviewNotes: notes, reviewedBy: user.id, reviewedAt: now, updatedAt: now }); this.logger.write({ operation: 'approve', seriesId, episodeId, assemblyId, assemblyVersion: value.version, preset: value.exportPreset, status: 'approved' }); return value; }
  async reject(user: AuthenticatedUser, seriesId: string, episodeId: string, assemblyId: string, notes: string): Promise<EpisodeAssembly> { await this.requireEpisode(user, seriesId, episodeId, 'OWNER'); const value = await this.requireAssembly(seriesId, episodeId, assemblyId); const now = this.now(); return this.repository.updateEpisodeAssembly({ ...value, status: 'rejected', reviewState: 'rejected', reviewNotes: notes, reviewedBy: user.id, reviewedAt: now, updatedAt: now }); }
  async setPreferred(user: AuthenticatedUser, seriesId: string, episodeId: string, assemblyId: string): Promise<EpisodeAssembly> { await this.requireEpisode(user, seriesId, episodeId, 'OWNER'); const selected = await this.requireAssembly(seriesId, episodeId, assemblyId); if (selected.status !== 'approved' || selected.reviewState !== 'approved') throw new Error('Only approved assembly versions can be preferred'); const now = this.now(); for (const assembly of await this.repository.listEpisodeAssemblies(seriesId, episodeId)) if (assembly.preferred && assembly.id !== selected.id) await this.repository.updateEpisodeAssembly({ ...assembly, preferred: false, supersededAt: now, updatedAt: now }); return this.repository.updateEpisodeAssembly({ ...selected, preferred: true, updatedAt: now }); }

  private selectAsset(assets: GeneratedAsset[], type: 'video-clip' | 'audio'): { asset?: GeneratedAsset; reason?: 'preferred-approved' | 'latest-approved' } { const approved = assets.filter((asset) => asset.assetType === type && asset.reviewStatus === 'approved').sort((a, b) => b.version - a.version || b.createdAt.getTime() - a.createdAt.getTime()); const preferred = approved.filter((asset) => asset.preferred)[0]; return preferred ? { asset: preferred, reason: 'preferred-approved' } : approved[0] ? { asset: approved[0], reason: 'latest-approved' } : {}; }
  private selectCaption(tracks: CaptionTrack[]): CaptionTrack | undefined { const approved = tracks.filter((track) => track.reviewStatus === 'approved').sort((a, b) => b.version - a.version || b.createdAt.getTime() - a.createdAt.getTime()); return approved.find((track) => track.preferred) || approved[0]; }
  private async requireEpisode(user: AuthenticatedUser, seriesId: string, episodeId: string, role: 'OWNER' | 'VIEWER'): Promise<void> { await this.production.authorizeMediaOperation(user, seriesId, role); if (!(await this.repository.getEpisode(seriesId, episodeId))) throw new Error(`Episode ${episodeId} was not found`); }
  private async requireAssembly(seriesId: string, episodeId: string, assemblyId: string): Promise<EpisodeAssembly> { const value = await this.repository.getEpisodeAssembly(seriesId, episodeId, assemblyId); if (!value) throw new Error(`Episode assembly ${assemblyId} was not found`); return value; }
}
