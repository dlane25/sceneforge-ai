import { DeterministicAgent } from '../base';
import type { AgentContext, AgentResponse, ShowrunnerOutput } from '../types';

export interface ShowrunnerInput {
  concept: string;
}

export class ShowrunnerAgent extends DeterministicAgent<ShowrunnerInput, ShowrunnerOutput> {
  readonly identity = 'showrunner' as const;

  protected run(input: ShowrunnerInput, context: AgentContext): AgentResponse<ShowrunnerOutput> {
    const { series } = context;
    const episodes = series.episodes.slice(0, 5).map((episode) => ({
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      hook: episode.hook,
      synopsis: episode.synopsis,
      majorBeats: [episode.synopsis.split('.')[0] || episode.synopsis, 'The family must choose between truth and power.'],
      cliffhanger: episode.cliffhanger,
    }));
    return {
      output: {
        title: series.title,
        logline: series.logline,
        genre: series.genre,
        tone: 'Cinematic, tense, intimate, and morally volatile',
        targetAudience: series.targetAudience,
        themes: ['power', 'betrayal', 'family loyalty', 'truth versus status'],
        characterConcepts: series.characters.map((character) => ({ name: character.name, role: character.role, desire: character.personality, secret: character.continuityNotes[1] || 'A guarded past' })),
        worldConcepts: [{ name: 'Sterling Penthouse', purpose: 'Family pressure cooker', visualSignature: series.visualStyle }, { name: 'Sterling Capital Offices', purpose: 'Public power and private risk', visualSignature: 'Dark wood, glass, and gold accents' }],
        seasonArc: 'Marcus Sterling loses control of the empire he built as family secrets and Julian Ashford’s revenge converge.',
        episodeOutline: episodes,
        majorStoryBeats: ['The missing partner destabilizes Marcus.', 'Julian returns with leverage.', 'Sophia discovers the family’s lies.'],
        unresolvedStoryThreads: ['Who is Isabella meeting in secret?', 'What evidence does Julian possess?', 'Will Sophia protect or expose Marcus?'],
      },
      confidence: 0.91,
      explanation: `Mapped the concept to ${series.episodeCount} planned episodes and the established Empire of Lies canon.`,
      warnings: input.concept.trim() ? [] : ['Concept was empty; used the existing series bible.'],
      metadata: { mode: 'deterministic-fixture', episodeCount: episodes.length },
    };
  }
}
