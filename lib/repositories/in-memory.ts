import type { AgentExecution } from '@/lib/agents';
import type { ApprovalDecision, PipelineRun } from '@/lib/orchestration';
import type { Character, CharacterInput, ContinuityFact, Episode, EpisodeInput, Location, LocationInput, Scene, SceneInput, Series, StoryFact, StoryFactInput } from '@/types';
import { EMPIRE_OF_LIES_CHARACTERS, EMPIRE_OF_LIES_SERIES, createEmpireOfLiesEpisodes } from '@/lib/mock';
import type { PersistedUser, PersistenceRepository, ProductionMembershipRecord, PipelineStageStatus, SeriesInput } from './contracts';

function clone<T>(value: T): T { return structuredClone(value); }

export class InMemoryPersistenceRepository implements PersistenceRepository {
  private users = new Map<string, PersistedUser>();
  private memberships = new Map<string, ProductionMembershipRecord>();
  private pipelines = new Map<string, PipelineRun>();
  private executions = new Map<string, AgentExecution>();
  private facts = new Map<string, ContinuityFact>();
  private stages = new Map<string, { status: PipelineStageStatus; output?: unknown; metadata: Record<string, string | number | boolean> }>();
  private series = new Map<string, Series>();
  private characters = new Map<string, Character>();
  private locations = new Map<string, Location>();
  private episodes = new Map<string, Episode>();
  private scenes = new Map<string, Scene>();
  private storyFacts = new Map<string, StoryFact>();

  constructor() {
    this.series.set(EMPIRE_OF_LIES_SERIES.id, clone({ ...EMPIRE_OF_LIES_SERIES, characters: EMPIRE_OF_LIES_CHARACTERS, episodes: createEmpireOfLiesEpisodes() }));
  }
  async getUser(id: string): Promise<PersistedUser | undefined> { const value = this.users.get(id); return value ? clone(value) : undefined; }
  async findUserByEmail(email: string): Promise<PersistedUser | undefined> { const value = [...this.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase()); return value ? clone(value) : undefined; }
  async upsertUser(user: PersistedUser): Promise<PersistedUser> { this.users.set(user.id, clone(user)); return clone(user); }
  async upsertUserIdentity(user: Omit<PersistedUser, 'id'>): Promise<PersistedUser> {
    const existing = [...this.users.values()].find((value) => (value.provider === user.provider && value.providerSubject === user.providerSubject) || value.email.toLowerCase() === user.email.toLowerCase());
    const record = existing || { ...user, id: `user_${user.provider}_${user.providerSubject}`.replace(/[^a-zA-Z0-9_-]/g, '_') };
    this.users.set(record.id, clone(record));
    return clone(record);
  }
  async getMembership(userId: string, seriesId: string): Promise<ProductionMembershipRecord | undefined> { const value = this.memberships.get(`${userId}:${seriesId}`); return value ? clone(value) : undefined; }
  async upsertMembership(record: ProductionMembershipRecord): Promise<ProductionMembershipRecord> { this.memberships.set(`${record.userId}:${record.seriesId}`, clone(record)); return clone(record); }
  async listMemberships(seriesId: string): Promise<ProductionMembershipRecord[]> { return [...this.memberships.values()].filter((value) => value.seriesId === seriesId).map(clone); }
  async removeMembership(userId: string, seriesId: string): Promise<void> { this.memberships.delete(`${userId}:${seriesId}`); }
  async listAccessibleSeries(userId: string): Promise<Series[]> { const ids = [...this.memberships.values()].filter((value) => value.userId === userId).map((value) => value.seriesId); return [...this.series.values()].filter((value) => ids.includes(value.id)).map(clone); }
  async getSeries(seriesId: string): Promise<Series | undefined> { const value = this.series.get(seriesId); return value ? clone(value) : undefined; }
  async createSeries(ownerId: string, input: SeriesInput): Promise<Series> { const id = `series_${this.series.size + 1}`; const now = new Date(); const value: Series = { id, title: input.title, logline: input.logline, genre: input.genre, targetAudience: input.targetAudience, visualStyle: input.visualStyle, episodeCount: input.episodeCount, episodeDurationSeconds: input.episodeDurationSeconds, status: (input.status || 'draft') as Series['status'], characters: [], episodes: [], createdAt: now, updatedAt: now }; this.series.set(id, clone(value)); await this.upsertMembership({ id: `membership_${id}_${ownerId}`, userId: ownerId, seriesId: id, role: 'OWNER' }); return clone(value); }
  async updateSeries(seriesId: string, input: Partial<SeriesInput>): Promise<Series> { const value = this.series.get(seriesId); if (!value) throw new Error(`Series ${seriesId} was not found`); const updated = { ...value, ...input, status: (input.status || value.status) as Series['status'], updatedAt: new Date() }; this.series.set(seriesId, clone(updated)); return clone(updated); }
  async archiveSeries(seriesId: string): Promise<Series> { return this.updateSeries(seriesId, { status: 'archived' }); }
  async listCharacters(seriesId: string): Promise<Character[]> { return [...this.characters.values()].filter((value) => value.seriesId === seriesId).map(clone); }
  async getCharacter(seriesId: string, characterId: string): Promise<Character | undefined> { const value = this.characters.get(characterId); return value?.seriesId === seriesId ? clone(value) : undefined; }
  async createCharacter(seriesId: string, input: CharacterInput): Promise<Character> { const id = `character_${this.characters.size + 1}`; const value: Character = { id, seriesId, ...input, relationships: [], voiceProfile: input.voiceProfile, continuityNotes: input.continuityNotes || [], createdAt: new Date(), updatedAt: new Date() }; this.characters.set(id, clone(value)); return clone(value); }
  async updateCharacter(seriesId: string, characterId: string, input: Partial<CharacterInput>): Promise<Character> { const current = await this.getCharacter(seriesId, characterId); if (!current) throw new Error(`Character ${characterId} was not found`); const value = { ...current, ...input, updatedAt: new Date() }; this.characters.set(characterId, clone(value)); return clone(value); }
  async deleteCharacter(seriesId: string, characterId: string): Promise<void> { if (!(await this.getCharacter(seriesId, characterId))) throw new Error(`Character ${characterId} was not found`); this.characters.delete(characterId); }
  async listLocations(seriesId: string): Promise<Location[]> { return [...this.locations.values()].filter((value) => value.seriesId === seriesId).map(clone); }
  async getLocation(seriesId: string, locationId: string): Promise<Location | undefined> { const value = this.locations.get(locationId); return value?.seriesId === seriesId ? clone(value) : undefined; }
  async createLocation(seriesId: string, input: LocationInput): Promise<Location> { const id = `location_${this.locations.size + 1}`; const value: Location = { id, seriesId, ...input, props: [], continuityNotes: input.continuityNotes || [], createdAt: new Date(), updatedAt: new Date() }; this.locations.set(id, clone(value)); return clone(value); }
  async updateLocation(seriesId: string, locationId: string, input: Partial<LocationInput>): Promise<Location> { const current = await this.getLocation(seriesId, locationId); if (!current) throw new Error(`Location ${locationId} was not found`); const value = { ...current, ...input, updatedAt: new Date() }; this.locations.set(locationId, clone(value)); return clone(value); }
  async deleteLocation(seriesId: string, locationId: string): Promise<void> { if (!(await this.getLocation(seriesId, locationId))) throw new Error(`Location ${locationId} was not found`); if ([...this.scenes.values()].some((scene) => scene.locationId === locationId)) throw new Error('Location is referenced by a scene'); this.locations.delete(locationId); }
  async listEpisodes(seriesId: string): Promise<Episode[]> { return [...this.episodes.values()].filter((value) => value.seriesId === seriesId).map(clone); }
  async getEpisode(seriesId: string, episodeId: string): Promise<Episode | undefined> { const value = this.episodes.get(episodeId); return value?.seriesId === seriesId ? clone(value) : undefined; }
  async createEpisode(seriesId: string, input: EpisodeInput): Promise<Episode> { if ([...this.episodes.values()].some((value) => value.seriesId === seriesId && value.episodeNumber === input.episodeNumber)) throw new Error('Episode number must be unique within a production'); const id = `episode_${this.episodes.size + 1}`; const value: Episode = { id, seriesId, episodeNumber: input.episodeNumber, title: input.title, hook: input.hook || '', synopsis: input.synopsis, cliffhanger: input.cliffhanger || '', status: input.status || 'draft', estimatedDurationSeconds: input.estimatedDurationSeconds, scenes: [], createdAt: new Date(), updatedAt: new Date() }; this.episodes.set(id, clone(value)); return clone(value); }
  async updateEpisode(seriesId: string, episodeId: string, input: Partial<EpisodeInput>): Promise<Episode> { const current = await this.getEpisode(seriesId, episodeId); if (!current) throw new Error(`Episode ${episodeId} was not found`); if (input.episodeNumber !== undefined && [...this.episodes.values()].some((value) => value.seriesId === seriesId && value.id !== episodeId && value.episodeNumber === input.episodeNumber)) throw new Error('Episode number must be unique within a production'); const value = { ...current, ...input, updatedAt: new Date() }; this.episodes.set(episodeId, clone(value)); return clone(value); }
  async deleteEpisode(seriesId: string, episodeId: string): Promise<void> { if (!(await this.getEpisode(seriesId, episodeId))) throw new Error(`Episode ${episodeId} was not found`); if ([...this.scenes.values()].some((scene) => scene.episodeId === episodeId)) throw new Error('Episode has scenes and cannot be deleted'); this.episodes.delete(episodeId); }
  async listScenes(seriesId: string, episodeId: string): Promise<Scene[]> { if (!(await this.getEpisode(seriesId, episodeId))) throw new Error(`Episode ${episodeId} was not found`); return [...this.scenes.values()].filter((value) => value.episodeId === episodeId).map(clone); }
  async getScene(seriesId: string, episodeId: string, sceneId: string): Promise<Scene | undefined> { const episode = await this.getEpisode(seriesId, episodeId); const value = this.scenes.get(sceneId); return episode && value?.episodeId === episodeId ? clone(value) : undefined; }
  async createScene(seriesId: string, episodeId: string, input: SceneInput): Promise<Scene> { if (!(await this.getEpisode(seriesId, episodeId))) throw new Error(`Episode ${episodeId} was not found`); if ([...this.scenes.values()].some((value) => value.episodeId === episodeId && value.sceneNumber === input.sceneNumber)) throw new Error('Scene number must be unique within an episode'); if (input.locationId && !(await this.getLocation(seriesId, input.locationId))) throw new Error('Location must belong to the production'); const id = `scene_${this.scenes.size + 1}`; const value: Scene = { id, episodeId, sceneNumber: input.sceneNumber, title: input.title, description: input.description, locationId: input.locationId || '', timeOfDay: input.timeOfDay, estimatedDurationSeconds: input.estimatedDurationSeconds, status: input.status || 'draft', shots: [], characterIds: [], createdAt: new Date(), updatedAt: new Date() }; this.scenes.set(id, clone(value)); return clone(value); }
  async updateScene(seriesId: string, episodeId: string, sceneId: string, input: Partial<SceneInput>): Promise<Scene> { const current = await this.getScene(seriesId, episodeId, sceneId); if (!current) throw new Error(`Scene ${sceneId} was not found`); if (input.locationId && !(await this.getLocation(seriesId, input.locationId))) throw new Error('Location must belong to the production'); const value = { ...current, ...input, updatedAt: new Date() }; this.scenes.set(sceneId, clone(value)); return clone(value); }
  async deleteScene(seriesId: string, episodeId: string, sceneId: string): Promise<void> { if (!(await this.getScene(seriesId, episodeId, sceneId))) throw new Error(`Scene ${sceneId} was not found`); this.scenes.delete(sceneId); }
  async listStoryFacts(seriesId: string): Promise<StoryFact[]> { return [...this.storyFacts.values()].filter((value) => value.seriesId === seriesId).map(clone); }
  async createStoryFact(seriesId: string, input: StoryFactInput): Promise<StoryFact> { if (input.episodeId && !(await this.getEpisode(seriesId, input.episodeId))) throw new Error('Episode must belong to the production'); if (input.sceneId && ![...this.scenes.values()].some((scene) => scene.id === input.sceneId && [...this.episodes.values()].some((episode) => episode.id === scene.episodeId && episode.seriesId === seriesId))) throw new Error('Scene must belong to the production'); const id = `story_fact_${this.storyFacts.size + 1}`; const value: StoryFact = { id, seriesId, ...input, type: 'unresolved', affectedCharacterIds: [], relatedFactIds: [], createdAt: new Date(), updatedAt: new Date() }; this.storyFacts.set(id, clone(value)); return clone(value); }
  async updateStoryFact(seriesId: string, factId: string, input: Partial<StoryFactInput>): Promise<StoryFact> { const current = this.storyFacts.get(factId); if (!current || current.seriesId !== seriesId) throw new Error(`Story fact ${factId} was not found`); const value = { ...current, ...input, updatedAt: new Date() }; this.storyFacts.set(factId, clone(value)); return clone(value); }
  async deleteStoryFact(seriesId: string, factId: string): Promise<void> { if (!(await this.storyFacts.get(factId)) || this.storyFacts.get(factId)?.seriesId !== seriesId) throw new Error(`Story fact ${factId} was not found`); this.storyFacts.delete(factId); }
  async create(pipeline: PipelineRun): Promise<PipelineRun> { this.pipelines.set(pipeline.id, clone(pipeline)); return clone(pipeline); }
  async get(id: string): Promise<PipelineRun | undefined> { const value = this.pipelines.get(id); return value ? clone(value) : undefined; }
  async update(pipeline: PipelineRun): Promise<PipelineRun> { this.pipelines.set(pipeline.id, clone(pipeline)); return clone(pipeline); }
  async listExecutions(pipelineId?: string): Promise<AgentExecution[]> { return [...this.executions.values()].filter((execution) => !pipelineId || pipelineId === execution.metadata.pipelineId).map(clone); }
  async saveExecution(execution: AgentExecution, pipelineId: string): Promise<AgentExecution> { this.executions.set(execution.id, clone({ ...execution, metadata: { ...execution.metadata, pipelineId } })); return clone(execution); }
  async saveApproval(approval: ApprovalDecision): Promise<ApprovalDecision> { const pipeline = this.pipelines.get(approval.pipelineId); if (pipeline) { pipeline.approval = clone(approval); this.pipelines.set(pipeline.id, pipeline); } return clone(approval); }
  async saveStage(pipelineId: string, stageKey: string, status: PipelineStageStatus, output?: unknown, metadata: Record<string, string | number | boolean> = {}): Promise<void> { this.stages.set(`${pipelineId}:${stageKey}`, clone({ status, output, metadata })); }
  async addFact(fact: ContinuityFact): Promise<ContinuityFact> { this.facts.set(fact.id, clone(fact)); return clone(fact); }
  async listFacts(seriesId: string): Promise<ContinuityFact[]> { return [...this.facts.values()].filter((fact) => fact.seriesId === seriesId).map(clone); }
  async getActiveFacts(seriesId: string, episodeNumber: number, sceneNumber?: number, shotNumber?: number): Promise<ContinuityFact[]> {
    const facts = await this.listFacts(seriesId);
    return facts.filter((fact) => {
      if (episodeNumber < fact.validFromEpisode || (fact.validToEpisode !== undefined && episodeNumber > fact.validToEpisode)) return false;
      if (fact.validFromScene !== undefined && episodeNumber === fact.validFromEpisode && sceneNumber !== undefined && sceneNumber < fact.validFromScene) return false;
      if (fact.validToScene !== undefined && episodeNumber === fact.validToEpisode && sceneNumber !== undefined && sceneNumber > fact.validToScene) return false;
      if (fact.validFromShot !== undefined && sceneNumber === fact.validFromScene && shotNumber !== undefined && shotNumber < fact.validFromShot) return false;
      if (fact.validToShot !== undefined && sceneNumber === fact.validToScene && shotNumber !== undefined && shotNumber > fact.validToShot) return false;
      return true;
    });
  }
  async reset(): Promise<void> { this.users.clear(); this.memberships.clear(); this.pipelines.clear(); this.executions.clear(); this.facts.clear(); this.stages.clear(); this.series.clear(); this.characters.clear(); this.locations.clear(); this.episodes.clear(); this.scenes.clear(); this.storyFacts.clear(); this.series.set(EMPIRE_OF_LIES_SERIES.id, clone({ ...EMPIRE_OF_LIES_SERIES, characters: EMPIRE_OF_LIES_CHARACTERS, episodes: createEmpireOfLiesEpisodes() })); }
}

export const memoryRepository = new InMemoryPersistenceRepository();
