import 'server-only';

import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series/service';
import type { CaptionFormat, CaptionSegment, CaptionTrack } from '@/types';

export interface CaptionGenerationInput { language: string; format: CaptionFormat }

function timestamp(ms: number, format: CaptionFormat): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const milliseconds = ms % 1000;
  const separator = format === 'srt' ? ',' : '.';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${separator}${String(milliseconds).padStart(3, '0')}`;
}

export function renderCaptionContent(format: CaptionFormat, segments: CaptionSegment[]): string {
  const cues = segments.map((segment) => {
    const text = segment.speaker ? (format === 'vtt' ? `<v ${segment.speaker}>${segment.text}</v>` : `${segment.speaker}: ${segment.text}`) : segment.text;
    return `${format === 'srt' ? `${segment.sequence}\n` : ''}${timestamp(segment.startMs, format)} --> ${timestamp(segment.endMs, format)}\n${text}`;
  }).join('\n\n');
  return format === 'vtt' ? `WEBVTT\n\n${cues}\n` : `${cues}\n`;
}

export class CaptionService {
  private readonly production: ProductionService;
  constructor(private readonly repository: PersistenceRepository, private readonly now: () => Date = () => new Date()) { this.production = new ProductionService(repository); }

  async generateEpisode(user: AuthenticatedUser, seriesId: string, episodeId: string, input: CaptionGenerationInput): Promise<CaptionTrack> {
    await this.production.authorizeMediaOperation(user, seriesId, 'OWNER');
    const episode = (await this.production.listEpisodes(user, seriesId)).find((value) => value.id === episodeId);
    if (!episode) throw new Error(`Episode ${episodeId} was not found`);
    const [scenes, characters, existing] = await Promise.all([this.production.listScenes(user, seriesId, episodeId), this.production.listCharacters(user, seriesId), this.repository.listCaptionTracks(seriesId, episodeId)]);
    const names = new Map(characters.map((character) => [character.id, character.name]));
    const version = existing.filter((track) => track.language === input.language && track.format === input.format).reduce((maximum, track) => Math.max(maximum, track.version), 0) + 1;
    const now = this.now();
    const trackId = `captions_${episodeId}_${input.language.replace(/[^a-z0-9-]/gi, '_')}_${input.format}_${version}`;
    const segments: CaptionSegment[] = [];
    let offsetMs = 0;
    for (const scene of [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber)) {
      const shots = await this.production.listShots(user, seriesId, episodeId, scene.id);
      for (const shot of [...shots].sort((a, b) => a.shotNumber - b.shotNumber)) {
        const durationMs = Math.max(500, shot.durationSeconds * 1000);
        if (shot.dialogue?.trim()) {
          const characterId = shot.characterIds[0];
          segments.push({ id: `${trackId}_segment_${segments.length + 1}`, trackId, sequence: segments.length + 1, sceneId: scene.id, shotId: shot.id, startMs: offsetMs, endMs: offsetMs + durationMs, text: shot.dialogue.trim(), speaker: characterId ? names.get(characterId) : undefined, characterId, confidence: 1 });
        }
        offsetMs += durationMs;
      }
    }
    if (!segments.length) throw new Error('Episode has no dialogue timing metadata for captions');
    const track: CaptionTrack = { id: trackId, seriesId, episodeId, language: input.language, format: input.format, source: 'dialogue-timing', content: renderCaptionContent(input.format, segments), version, reviewStatus: 'pending', preferred: false, generatedAt: now, createdAt: now, updatedAt: now, segments };
    return this.repository.createCaptionTrack(track);
  }

  async list(user: AuthenticatedUser, seriesId: string, episodeId: string): Promise<CaptionTrack[]> { await this.production.authorizeMediaOperation(user, seriesId, 'VIEWER'); const episode = (await this.production.listEpisodes(user, seriesId)).find((value) => value.id === episodeId); if (!episode) throw new Error(`Episode ${episodeId} was not found`); return this.repository.listCaptionTracks(seriesId, episodeId); }

  async review(user: AuthenticatedUser, seriesId: string, episodeId: string, trackId: string, status: 'approved' | 'rejected', notes?: string): Promise<CaptionTrack> {
    await this.production.authorizeMediaOperation(user, seriesId, 'OWNER');
    const track = await this.requireTrack(seriesId, episodeId, trackId);
    const now = this.now();
    return this.repository.updateCaptionTrack({ ...track, reviewStatus: status, reviewNotes: notes, reviewedBy: user.id, reviewedAt: now, updatedAt: now });
  }

  async setPreferred(user: AuthenticatedUser, seriesId: string, episodeId: string, trackId: string): Promise<CaptionTrack> {
    await this.production.authorizeMediaOperation(user, seriesId, 'OWNER');
    const selected = await this.requireTrack(seriesId, episodeId, trackId);
    if (selected.reviewStatus !== 'approved') throw new Error('Only approved caption tracks can be preferred');
    const now = this.now();
    for (const track of await this.repository.listCaptionTracks(seriesId, episodeId)) {
      if (track.preferred && track.id !== selected.id && track.language === selected.language && track.format === selected.format) await this.repository.updateCaptionTrack({ ...track, preferred: false, reviewStatus: 'superseded', supersededAt: now, updatedAt: now });
    }
    return this.repository.updateCaptionTrack({ ...selected, preferred: true, updatedAt: now });
  }

  async export(user: AuthenticatedUser, seriesId: string, episodeId: string, trackId: string): Promise<CaptionTrack> { await this.production.authorizeMediaOperation(user, seriesId, 'VIEWER'); return this.requireTrack(seriesId, episodeId, trackId); }
  private async requireTrack(seriesId: string, episodeId: string, trackId: string): Promise<CaptionTrack> { const track = await this.repository.getCaptionTrack(seriesId, episodeId, trackId); if (!track) throw new Error(`Caption track ${trackId} was not found`); return track; }
}
