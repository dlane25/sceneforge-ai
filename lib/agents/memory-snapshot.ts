import type { Character, Series } from '@/types';
import type { SeriesMemorySnapshot } from './types';

export function createMemorySnapshot(series: Series, continuityFacts: SeriesMemorySnapshot['continuityFacts'], unresolvedThreads: string[] = []): SeriesMemorySnapshot {
  const characterFacts = series.characters.flatMap((character: Character) => [
    `${character.name}: ${character.appearance}`,
    `${character.name}: wardrobe ${character.wardrobe}`,
    `${character.name}: ${character.personality}`,
    ...character.continuityNotes.map((note) => `${character.name}: ${note}`),
  ]);

  return {
    characterFacts,
    worldFacts: [],
    storyFacts: [],
    continuityFacts,
    unresolvedThreads,
  };
}
