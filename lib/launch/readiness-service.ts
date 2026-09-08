import 'server-only';

import type { AuthenticatedUser } from '@/lib/auth';
import { ContinuityChecker } from '@/lib/memory/continuity-checker';
import type { PersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { EpisodeAssembly, EpisodeExportJob, GenerationJob, ProductionReadinessReport, ReadinessCategory, ReadinessCheck, RightsAttestation } from '@/types';
import { assessProductionConfiguration, type ConfigurationAssessmentOptions } from './config';
import { isSafeDeliveryUri } from './uri-safety';
import { validateMediaSource } from '@/lib/export/source-safety';
import { consoleObservabilitySink, silentObservabilitySink, type ObservabilitySink } from '@/lib/observability';

interface ReadinessOptions { now?: () => Date; allowMockUris?: boolean; logger?: ObservabilitySink }

function summarize(id: string, scope: 'series' | 'episode', checks: ReadinessCheck[], now: Date, seriesId: string, episodeId?: string): ProductionReadinessReport {
  const blockingCount = checks.filter((check) => check.status === 'fail' && check.blocking).length;
  return { id, scope, seriesId, episodeId, checks, blockingCount, warningCount: checks.filter((check) => check.status === 'warning').length, passedCount: checks.filter((check) => check.status === 'pass').length, ready: blockingCount === 0, checkedAt: now };
}

export class ProductionReadinessService {
  private readonly production: ProductionService;
  private readonly now: () => Date;
  private readonly allowMockUris: boolean;
  private readonly logger: ObservabilitySink;
  constructor(private readonly repository: PersistenceRepository, options: ReadinessOptions = {}) { this.production = new ProductionService(repository); this.now = options.now || (() => new Date()); this.allowMockUris = options.allowMockUris ?? process.env.NODE_ENV === 'test'; this.logger = options.logger || (process.env.NODE_ENV === 'test' ? silentObservabilitySink : consoleObservabilitySink); }

  application(env: Record<string, string | undefined> = process.env, options: ConfigurationAssessmentOptions = {}): ProductionReadinessReport { const value = assessProductionConfiguration(env, { ...options, now: options.now || this.now() }); if (!value.ready) this.logger.write({ event: 'configuration_failure', blockingCount: value.blockingCount, warningCount: value.warningCount, status: 'unready' }); return value; }

  async rightsAttestations(user: AuthenticatedUser, seriesId: string): Promise<RightsAttestation[]> {
    return (await this.production.listCharacters(user, seriesId)).map((character) => {
      const rights = character.voiceProfile.rights; const sourceType = rights?.sourceType || 'synthetic'; const requires = ['licensed', 'uploaded-reference', 'cloned'].includes(sourceType);
      const satisfied = !requires || Boolean(rights?.rightsConfirmed && rights?.consentConfirmed && rights.approvalState === 'approved' && rights.confirmedAt);
      return { characterId: character.id, characterName: character.name, sourceType, rightsConfirmed: rights?.rightsConfirmed ?? !requires, consentConfirmed: rights?.consentConfirmed ?? !requires, approvalState: rights?.approvalState || 'not-required', satisfied };
    });
  }

  async episode(user: AuthenticatedUser, seriesId: string, episodeId: string): Promise<ProductionReadinessReport> {
    const now = this.now(); await this.production.authorizeMediaOperation(user, seriesId, 'VIEWER'); const episode = await this.repository.getEpisode(seriesId, episodeId); if (!episode) throw new Error(`Episode ${episodeId} was not found`);
    const checks: ReadinessCheck[] = [];
    const add = (id: string, category: ReadinessCategory, ok: boolean, explanation: string, remediation: string, resourceType = 'episode', resourceId = episodeId, warning = false, metadata?: Record<string, string | number | boolean>) => checks.push({ id: `episode.${episodeId}.${id}`, category, severity: ok ? 'info' : warning ? 'warning' : 'error', status: ok ? 'pass' : warning ? 'warning' : 'fail', explanation, remediation, affectedResource: { type: resourceType, id: resourceId }, checkedAt: now, blocking: !ok && !warning, metadata });
    const scenes = [...await this.repository.listScenes(seriesId, episodeId)].sort((a, b) => a.sceneNumber - b.sceneNumber);
    add('scenes', 'episode-content', scenes.length > 0, scenes.length ? `${scenes.length} scene(s) are present.` : 'No scenes are present.', 'Create and order episode scenes.');
    const facts = await this.repository.listFacts(seriesId); const checker = new ContinuityChecker(); let shotCount = 0; let storyboardReady = 0; let blockingContinuity = 0; let warningContinuity = 0; const allJobs: GenerationJob[] = []; const referencedCharacterIds = new Set<string>();
    for (const scene of scenes) {
      const shots = [...await this.repository.listShots(seriesId, episodeId, scene.id)].sort((a, b) => a.shotNumber - b.shotNumber); add(`scene.${scene.id}.shots`, 'episode-content', shots.length > 0, shots.length ? `Scene ${scene.sceneNumber} has ${shots.length} shot(s).` : `Scene ${scene.sceneNumber} has no shots.`, 'Add storyboard shots to this scene.', 'scene', scene.id);
      for (const shot of shots) {
        shot.characterIds.forEach((id) => referencedCharacterIds.add(id));
        shotCount += 1; const storyboard = await this.repository.getStoryboard(seriesId, episodeId, scene.id, shot.id); if (storyboard) storyboardReady += 1;
        add(`shot.${shot.id}.storyboard`, 'episode-content', Boolean(storyboard), storyboard ? 'Storyboard placeholder is present.' : 'Storyboard placeholder is missing.', 'Create the shot storyboard.', 'shot', shot.id);
        const assets = await this.repository.listGeneratedAssets(seriesId, episodeId, scene.id, shot.id); const preferredVideo = assets.find((asset) => asset.assetType === 'video-clip' && asset.preferred); const preferredAudio = assets.find((asset) => asset.assetType === 'audio' && asset.preferred); const usableVideo = preferredVideo?.reviewStatus === 'approved'; const dialogueRequired = Boolean(shot.dialogue?.trim()); const usableAudio = !dialogueRequired || preferredAudio?.reviewStatus === 'approved';
        add(`shot.${shot.id}.video`, 'episode-content', usableVideo, usableVideo ? 'Preferred video is approved.' : preferredVideo?.reviewStatus === 'rejected' ? 'The preferred video is rejected.' : 'An approved preferred video is missing.', 'Approve and mark the final video preferred.', 'shot', shot.id);
        add(`shot.${shot.id}.audio`, 'episode-content', usableAudio, usableAudio ? dialogueRequired ? 'Preferred dialogue audio is approved.' : 'Dialogue audio is not required.' : preferredAudio?.reviewStatus === 'rejected' ? 'The preferred dialogue audio is rejected.' : 'Approved preferred dialogue audio is missing.', 'Generate, approve, and prefer dialogue audio.', 'shot', shot.id);
        for (const asset of assets.filter((value) => value.preferred)) { let sourceSafe = true; try { validateMediaSource(asset.storageUri || asset.uri, this.allowMockUris); } catch { sourceSafe = false; } add(`asset.${asset.id}.source`, 'storage', sourceSafe, sourceSafe ? 'Preferred asset source is safe.' : 'Preferred asset source is unsafe.', 'Move the asset into managed storage or use an approved public HTTPS reference.', 'asset', asset.id); }
        const violations = checker.checkShot(shot, episode.episodeNumber, scene.sceneNumber, facts); blockingContinuity += violations.filter((value) => value.severity === 'high' || value.severity === 'critical').length; warningContinuity += violations.filter((value) => value.severity === 'low' || value.severity === 'medium').length;
        const jobs = await this.repository.listGenerationJobs(seriesId, episodeId, scene.id, shot.id); allJobs.push(...jobs);
        const unresolvedFailed = jobs.filter((job) => job.status === 'failed' && !jobs.some((candidate) => candidate.generationType === job.generationType && candidate.status === 'completed' && candidate.createdAt >= job.createdAt));
        add(`shot.${shot.id}.failed-jobs`, 'operations', unresolvedFailed.length === 0, unresolvedFailed.length ? `${unresolvedFailed.length} generation failure(s) remain unresolved.` : 'No unresolved generation failures.', 'Retry the failed job through its approval-gated workflow or complete a replacement.', 'shot', shot.id);
      }
    }
    add('shots', 'episode-content', shotCount > 0, shotCount ? `${shotCount} shot(s) are present.` : 'No shots are present.', 'Add ordered shots to the episode.');
    add('storyboards', 'episode-content', shotCount > 0 && storyboardReady === shotCount, `${storyboardReady} of ${shotCount} shots have storyboards.`, 'Create every missing storyboard.');
    add('continuity.blocking', 'security-governance', blockingContinuity === 0, blockingContinuity ? `${blockingContinuity} blocking continuity issue(s) remain.` : 'No blocking continuity issues were found.', 'Resolve high/critical continuity conflicts before launch.');
    add('continuity.warnings', 'security-governance', warningContinuity === 0, warningContinuity ? `${warningContinuity} continuity warning(s) require review.` : 'No continuity warnings were found.', 'Review or explicitly override continuity warnings.', 'episode', episodeId, warningContinuity > 0);
    for (const attestation of (await this.rightsAttestations(user, seriesId)).filter((value) => referencedCharacterIds.has(value.characterId))) add(`rights.${attestation.characterId}`, 'security-governance', attestation.satisfied, attestation.satisfied ? `${attestation.characterName} voice rights/consent are satisfied.` : `${attestation.characterName} voice rights/consent are incomplete or rejected.`, 'Confirm rights and consent, then record owner approval.', 'character', attestation.characterId, false, { character: attestation.characterName, sourceType: attestation.sourceType, rightsConfirmed: attestation.rightsConfirmed, consentConfirmed: attestation.consentConfirmed, reviewState: attestation.approvalState });
    const captions = await this.repository.listCaptionTracks(seriesId, episodeId); const requiresCaptions = scenes.length > 0 && (await Promise.all(scenes.map((scene) => this.repository.listShots(seriesId, episodeId, scene.id)))).flat().some((shot) => Boolean(shot.dialogue?.trim())); const caption = captions.find((track) => track.preferred && track.reviewStatus === 'approved');
    add('captions', 'episode-content', !requiresCaptions || Boolean(caption), caption ? 'Approved preferred captions are present.' : requiresCaptions ? 'Approved preferred captions are missing.' : 'Captions are not required for a silent episode.', 'Generate, review, and prefer an episode caption track.');
    const assemblies = await this.repository.listEpisodeAssemblies(seriesId, episodeId); const assembly = assemblies.find((value) => value.preferred); const assemblyReady = Boolean(assembly && assembly.status === 'approved' && assembly.reviewState === 'approved' && assembly.validationPassed);
    add('assembly', 'export', assemblyReady, assemblyReady ? `Preferred assembly v${assembly!.version} is approved and valid.` : 'An approved, valid preferred assembly is missing.', 'Build, validate, approve, and prefer an assembly.');
    if (assembly) {
      let invalidSelected = false;
      for (const item of assembly.items) for (const assetId of [item.videoAssetId, item.audioAssetId]) if (assetId) { const asset = await this.repository.getGeneratedAsset(seriesId, episodeId, item.sceneId, item.shotId, assetId); if (!asset || asset.reviewStatus !== 'approved' || !asset.preferred) invalidSelected = true; }
      add('assembly.rejected-assets', 'security-governance', !invalidSelected, invalidSelected ? 'The preferred assembly selects missing, unapproved, rejected, or non-preferred content.' : 'The preferred assembly selects only approved preferred content.', 'Rebuild from approved preferred assets.', 'assembly', assembly.id);
    }
    const exports = await this.repository.listEpisodeExportJobs(seriesId, episodeId); const completed = exports.filter((job) => job.assemblyId === assembly?.id && job.status === 'completed').sort((a, b) => b.exportVersion - a.exportVersion)[0];
    add('export.completed', 'export', Boolean(completed), completed ? `Export v${completed.exportVersion} completed.` : 'No completed export exists for the preferred assembly.', 'Prepare, approve, and complete the final export.');
    if (completed) this.addExportChecks(add, completed);
    const unresolvedExportFailures = exports.filter((job) => job.status === 'failed' && !exports.some((candidate) => candidate.assemblyId === job.assemblyId && candidate.status === 'completed' && candidate.exportVersion > job.exportVersion));
    add('export.failed-jobs', 'operations', unresolvedExportFailures.length === 0, unresolvedExportFailures.length ? `${unresolvedExportFailures.length} export failure(s) remain unresolved.` : 'No unresolved export failures.', 'Retry the failed export through its approval-gated workflow or complete a replacement.');
    const approvalBlockers = allJobs.filter((job) => ['awaiting_approval', 'approved', 'queued', 'processing'].includes(job.status) && !job.outputAssetIds.length).length + exports.filter((job) => ['awaiting_approval', 'approved', 'queued', 'processing'].includes(job.status)).length;
    add('approvals', 'security-governance', approvalBlockers === 0, approvalBlockers ? `${approvalBlockers} approval/lifecycle gate(s) remain open.` : 'No approval gates remain open.', 'Complete, reject, or cancel outstanding governed jobs.');
    const result = summarize(`readiness_episode_${episodeId}_${now.toISOString()}`, 'episode', checks, now, seriesId, episodeId); if (!result.ready) this.logger.write({ event: 'readiness_failure', seriesId, episodeId, blockingCount: result.blockingCount, warningCount: result.warningCount, status: 'unready' }); return result;
  }

  async series(user: AuthenticatedUser, seriesId: string): Promise<ProductionReadinessReport> {
    const now = this.now(); const series = await this.production.getSeries(user, seriesId); const checks: ReadinessCheck[] = [];
    const add = (id: string, category: ReadinessCategory, ok: boolean, explanation: string, remediation: string, warning = false, metadata?: Record<string, string | number | boolean>) => checks.push({ id: `series.${seriesId}.${id}`, category, severity: ok ? 'info' : warning ? 'warning' : 'error', status: ok ? 'pass' : warning ? 'warning' : 'fail', explanation, remediation, affectedResource: { type: 'series', id: seriesId, label: series.title }, checkedAt: now, blocking: !ok && !warning, metadata });
    const complete = Boolean(series.title.trim() && series.logline.trim() && series.genre.trim() && series.targetAudience.trim() && series.visualStyle.trim() && series.episodeCount > 0 && series.episodeDurationSeconds > 0);
    add('metadata', 'series-data', complete, complete ? 'Series launch metadata is complete.' : 'Series launch metadata is incomplete.', 'Complete title, logline, genre, audience, visual style, and episode targets.');
    const memberships = await this.repository.listMemberships(seriesId); add('owner', 'security-governance', memberships.some((value) => value.role === 'OWNER'), 'Production ownership was evaluated.', 'Retain at least one owner.');
    const characters = await this.repository.listCharacters(seriesId); const locations = await this.repository.listLocations(seriesId); const episodes = await this.repository.listEpisodes(seriesId);
    add('characters', 'series-data', characters.length > 0, characters.length ? `${characters.length} character(s) are defined.` : 'No characters are defined.', 'Create the required cast.');
    add('locations', 'series-data', locations.length > 0, locations.length ? `${locations.length} location(s) are defined.` : 'No world locations are defined.', 'Create the required locations/world data.');
    add('episodes', 'series-data', episodes.length > 0, episodes.length ? `${episodes.length} episode(s) exist.` : 'No episodes exist.', 'Create at least one episode.');
    for (const attestation of await this.rightsAttestations(user, seriesId)) add(`rights.${attestation.characterId}`, 'security-governance', attestation.satisfied, attestation.satisfied ? `${attestation.characterName} rights/consent gate is satisfied.` : `${attestation.characterName} rights/consent gate is incomplete or rejected.`, 'Confirm rights and consent, then record owner approval.', false, { character: attestation.characterName, sourceType: attestation.sourceType, rightsConfirmed: attestation.rightsConfirmed, consentConfirmed: attestation.consentConfirmed, reviewState: attestation.approvalState });
    for (const episode of episodes) checks.push(...(await this.episode(user, seriesId, episode.id)).checks);
    const result = summarize(`readiness_series_${seriesId}_${now.toISOString()}`, 'series', checks, now, seriesId); if (!result.ready) this.logger.write({ event: 'readiness_failure', seriesId, blockingCount: result.blockingCount, warningCount: result.warningCount, status: 'unready' }); return result;
  }

  private addExportChecks(add: (id: string, category: ReadinessCategory, ok: boolean, explanation: string, remediation: string, resourceType?: string, resourceId?: string, warning?: boolean) => void, job: EpisodeExportJob): void {
    const metadata = Boolean(job.outputUri && job.outputFileName && job.durationMs && job.durationMs > 0 && job.fileSize && job.fileSize > 0 && job.checksum && job.completedAt);
    add('export.metadata', 'export', metadata, metadata ? 'Export delivery metadata is complete.' : 'Completed export metadata is incomplete.', 'Re-render the export and verify normalized output metadata.', 'export-job', job.id);
    add('export.output-uri', 'storage', Boolean(job.outputUri && isSafeDeliveryUri(job.outputUri, this.allowMockUris)), 'Export output accessibility and URI safety were evaluated.', 'Move output to managed storage or an approved HTTPS reference.', 'export-job', job.id);
    add('export.approval', 'security-governance', job.approvalState === 'approved', 'Export approval state was evaluated.', 'Obtain owner export approval.', 'export-job', job.id);
  }
}

export function preferredApprovedAssembly(values: EpisodeAssembly[]): EpisodeAssembly | undefined { return values.find((value) => value.preferred && value.status === 'approved' && value.reviewState === 'approved' && value.validationPassed); }
