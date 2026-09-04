import type { ContinuityFact } from '@/types';
import type { SeriesMemoryRepository } from '@/lib/repositories';

export class PersistentSeriesMemory {
  constructor(private readonly repository: SeriesMemoryRepository) {}

  addFact(fact: ContinuityFact): Promise<ContinuityFact> { return this.repository.addFact(fact); }
  listFacts(seriesId: string): Promise<ContinuityFact[]> { return this.repository.listFacts(seriesId); }
  getActiveFacts(seriesId: string, episodeNumber: number, sceneNumber?: number, shotNumber?: number): Promise<ContinuityFact[]> {
    return this.repository.getActiveFacts(seriesId, episodeNumber, sceneNumber, shotNumber);
  }
}
