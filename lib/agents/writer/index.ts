import { DeterministicAgent } from '../base';
import type { AgentContext, AgentResponse, EpisodeOutline, Screenplay } from '../types';

export class WriterAgent extends DeterministicAgent<EpisodeOutline, Screenplay> {
  readonly identity = 'writer' as const;

  protected run(input: EpisodeOutline, context: AgentContext): AgentResponse<Screenplay> {
    const episode = context.series.episodes.find((item) => item.episodeNumber === input.episodeNumber) || context.series.episodes[0];
    const marcus = context.series.characters.find((character) => character.name === 'Marcus Sterling');
    const sophia = context.series.characters.find((character) => character.name === 'Sophia Sterling');
    const scenes = [
      { id: `scene_${episode.id}_1`, sceneNumber: 1, locationId: 'loc_2_office', title: 'The call', action: 'Marcus studies the skyline as a phone vibrates on the desk.', dialogue: [{ characterId: marcus?.id || 'char_1_marcus', line: 'I built this empire to survive anything.' }], emotionalBeat: 'Controlled confidence gives way to unease.', revelation: input.majorBeats[0] },
      { id: `scene_${episode.id}_2`, sceneNumber: 2, locationId: 'loc_1_penthouse', title: 'The question', action: 'Sophia confronts Marcus in the penthouse, refusing to accept his explanation.', dialogue: [{ characterId: sophia?.id || 'char_3_sophia', line: 'How many versions of the truth are there?' }, { characterId: marcus?.id || 'char_1_marcus', line: 'Enough to keep this family standing.' }], emotionalBeat: 'A daughter chooses suspicion over obedience.' },
    ];
    return {
      output: { episodeId: episode.id, openingHook: input.hook, scenes, closingCliffhanger: input.cliffhanger, estimatedDurationSeconds: 72, memoryReferences: [...context.memory.characterFacts.slice(0, 4), ...context.memory.unresolvedThreads] },
      confidence: 0.88,
      explanation: 'Converted the selected outline into a two-scene vertical screenplay while carrying forward relevant character memory.',
      warnings: [],
      metadata: { targetDurationSeconds: 72, sceneCount: scenes.length },
    };
  }
}
