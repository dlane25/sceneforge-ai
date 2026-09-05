import type { AuthenticatedUser } from '@/lib/auth';
import { AuthorizationError } from '@/lib/auth';
import type { Character, CharacterInput, Episode, EpisodeInput, Location, LocationInput, Scene, SceneInput, Series, StoryFact, StoryFactInput } from '@/types';
import type { PersistedUser, PersistenceRepository, ProductionMembershipRecord, RepositoryRole, SeriesInput, SeriesMemberInput } from '@/lib/repositories';

export class ProductionService {
  constructor(private readonly repository: PersistenceRepository) {}

  async listAccessibleSeries(user: AuthenticatedUser): Promise<Series[]> {
    const persisted = await this.provisionUser(user);
    return this.repository.listAccessibleSeries(persisted.id);
  }

  async getSeries(user: AuthenticatedUser, seriesId: string): Promise<Series> {
    await this.requireRole(user, seriesId, 'VIEWER');
    const series = await this.repository.getSeries(seriesId);
    if (!series) throw new Error(`Series ${seriesId} was not found`);
    return series;
  }

  async createSeries(user: AuthenticatedUser, input: SeriesInput): Promise<Series> {
    const persisted = await this.provisionUser(user);
    return this.repository.createSeries(persisted.id, input);
  }

  async updateSeries(user: AuthenticatedUser, seriesId: string, input: Partial<SeriesInput>): Promise<Series> {
    await this.requireRole(user, seriesId, 'EDITOR');
    return this.repository.updateSeries(seriesId, input);
  }

  async archiveSeries(user: AuthenticatedUser, seriesId: string): Promise<Series> {
    await this.requireRole(user, seriesId, 'OWNER');
    return this.repository.archiveSeries(seriesId);
  }

  async listCharacters(user: AuthenticatedUser, seriesId: string): Promise<Character[]> { await this.requireRole(user, seriesId, 'VIEWER'); return this.repository.listCharacters(seriesId); }
  async createCharacter(user: AuthenticatedUser, seriesId: string, input: CharacterInput): Promise<Character> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.createCharacter(seriesId, input); }
  async updateCharacter(user: AuthenticatedUser, seriesId: string, characterId: string, input: Partial<CharacterInput>): Promise<Character> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.updateCharacter(seriesId, characterId, input); }
  async deleteCharacter(user: AuthenticatedUser, seriesId: string, characterId: string): Promise<void> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.deleteCharacter(seriesId, characterId); }
  async listLocations(user: AuthenticatedUser, seriesId: string): Promise<Location[]> { await this.requireRole(user, seriesId, 'VIEWER'); return this.repository.listLocations(seriesId); }
  async createLocation(user: AuthenticatedUser, seriesId: string, input: LocationInput): Promise<Location> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.createLocation(seriesId, input); }
  async updateLocation(user: AuthenticatedUser, seriesId: string, locationId: string, input: Partial<LocationInput>): Promise<Location> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.updateLocation(seriesId, locationId, input); }
  async deleteLocation(user: AuthenticatedUser, seriesId: string, locationId: string): Promise<void> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.deleteLocation(seriesId, locationId); }
  async listEpisodes(user: AuthenticatedUser, seriesId: string): Promise<Episode[]> { await this.requireRole(user, seriesId, 'VIEWER'); return this.repository.listEpisodes(seriesId); }
  async createEpisode(user: AuthenticatedUser, seriesId: string, input: EpisodeInput): Promise<Episode> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.createEpisode(seriesId, input); }
  async updateEpisode(user: AuthenticatedUser, seriesId: string, episodeId: string, input: Partial<EpisodeInput>): Promise<Episode> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.updateEpisode(seriesId, episodeId, input); }
  async deleteEpisode(user: AuthenticatedUser, seriesId: string, episodeId: string): Promise<void> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.deleteEpisode(seriesId, episodeId); }
  async listScenes(user: AuthenticatedUser, seriesId: string, episodeId: string): Promise<Scene[]> { await this.requireRole(user, seriesId, 'VIEWER'); return this.repository.listScenes(seriesId, episodeId); }
  async createScene(user: AuthenticatedUser, seriesId: string, episodeId: string, input: SceneInput): Promise<Scene> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.createScene(seriesId, episodeId, input); }
  async updateScene(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string, input: Partial<SceneInput>): Promise<Scene> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.updateScene(seriesId, episodeId, sceneId, input); }
  async deleteScene(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string): Promise<void> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.deleteScene(seriesId, episodeId, sceneId); }
  async listStoryFacts(user: AuthenticatedUser, seriesId: string): Promise<StoryFact[]> { await this.requireRole(user, seriesId, 'VIEWER'); return this.repository.listStoryFacts(seriesId); }
  async createStoryFact(user: AuthenticatedUser, seriesId: string, input: StoryFactInput): Promise<StoryFact> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.createStoryFact(seriesId, input); }
  async updateStoryFact(user: AuthenticatedUser, seriesId: string, factId: string, input: Partial<StoryFactInput>): Promise<StoryFact> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.updateStoryFact(seriesId, factId, input); }
  async deleteStoryFact(user: AuthenticatedUser, seriesId: string, factId: string): Promise<void> { await this.requireRole(user, seriesId, 'EDITOR'); return this.repository.deleteStoryFact(seriesId, factId); }

  async listMembers(user: AuthenticatedUser, seriesId: string): Promise<ProductionMembershipRecord[]> {
    await this.requireRole(user, seriesId, 'VIEWER');
    return this.repository.listMemberships(seriesId);
  }

  async addMember(user: AuthenticatedUser, seriesId: string, input: SeriesMemberInput): Promise<ProductionMembershipRecord> {
    await this.requireRole(user, seriesId, 'OWNER');
    const invited = await this.findOrProvisionMember(input);
    return this.repository.upsertMembership({ id: `membership_${seriesId}_${invited.id}`, userId: invited.id, seriesId, role: input.role });
  }

  async updateMemberRole(user: AuthenticatedUser, seriesId: string, memberId: string, role: RepositoryRole): Promise<ProductionMembershipRecord> {
    await this.requireRole(user, seriesId, 'OWNER');
    const current = await this.repository.getMembership(memberId, seriesId);
    if (!current) throw new Error(`Membership ${memberId} was not found`);
    if (current.role === 'OWNER' && role !== 'OWNER') await this.preventLastOwner(seriesId, memberId);
    return this.repository.upsertMembership({ ...current, role });
  }

  async removeMember(user: AuthenticatedUser, seriesId: string, memberId: string): Promise<void> {
    await this.requireRole(user, seriesId, 'OWNER');
    const current = await this.repository.getMembership(memberId, seriesId);
    if (!current) throw new Error(`Membership ${memberId} was not found`);
    if (current.role === 'OWNER') await this.preventLastOwner(seriesId, memberId);
    await this.repository.removeMembership(memberId, seriesId);
  }

  private async requireRole(user: AuthenticatedUser, seriesId: string, required: RepositoryRole): Promise<ProductionMembershipRecord> {
    const persisted = await this.provisionUser(user);
    const membership = await this.repository.getMembership(persisted.id, seriesId);
    if (!membership) throw new AuthorizationError('You do not have access to this production');
    const allowed = required === 'VIEWER' || membership.role === 'OWNER' || (required === 'EDITOR' && membership.role === 'EDITOR');
    if (!allowed) throw new AuthorizationError('Your production role does not permit this action');
    return membership;
  }

  private async provisionUser(user: AuthenticatedUser): Promise<PersistedUser> {
    return this.repository.upsertUserIdentity({ email: user.email, displayName: user.displayName, provider: user.provider, providerSubject: user.subject });
  }

  private async findOrProvisionMember(input: SeriesMemberInput): Promise<PersistedUser> {
    const existing = await this.repository.findUserByEmail(input.email);
    if (existing) return existing;
    return this.repository.upsertUserIdentity({ email: input.email, displayName: input.displayName || input.email, provider: 'invited', providerSubject: input.email.toLowerCase() });
  }

  private async preventLastOwner(seriesId: string, memberId: string): Promise<void> {
    const owners = (await this.repository.listMemberships(seriesId)).filter((membership) => membership.role === 'OWNER');
    if (owners.length <= 1 && owners[0]?.userId === memberId) throw new AuthorizationError('A production must retain at least one OWNER');
  }
}
