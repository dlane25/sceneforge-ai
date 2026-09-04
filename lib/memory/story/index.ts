import type { ContinuityFact, StoryFact } from '@/types';

export interface StoryDNA {
  seriesId: string;
  secrets: StoryFact[];
  relationships: Record<string, string>;
  timeline: Record<number, string[]>; // episode number -> events
  plotPoints: string[];
  unresolvedPlots: string[];
  facts: ContinuityFact[];
}

export class StoryMemory {
  private stories: Map<string, StoryDNA> = new Map();

  addStory(seriesId: string, dna: Partial<StoryDNA>): void {
    const existing = this.stories.get(seriesId) || {
      seriesId,
      facts: [],
      secrets: [],
      relationships: {},
      timeline: {},
      plotPoints: [],
      unresolvedPlots: [],
    };
    this.stories.set(seriesId, {
      ...existing,
      ...dna,
      facts: dna.facts || existing.facts,
      secrets: dna.secrets || existing.secrets,
      relationships: dna.relationships || existing.relationships,
      timeline: dna.timeline || existing.timeline,
      plotPoints: dna.plotPoints || existing.plotPoints,
      unresolvedPlots: dna.unresolvedPlots || existing.unresolvedPlots,
    });
  }

  getStory(seriesId: string): StoryDNA | undefined {
    return this.stories.get(seriesId);
  }

  addSecret(seriesId: string, secret: StoryFact): void {
    const story = this.stories.get(seriesId);
    if (!story) {
      this.addStory(seriesId, { secrets: [secret] });
    } else {
      story.secrets.push(secret);
    }
  }

  addTimelineEvent(seriesId: string, episodeNumber: number, event: string): void {
    const story = this.stories.get(seriesId);
    if (!story) {
      this.addStory(seriesId, {
        timeline: { [episodeNumber]: [event] },
      });
    } else {
      if (!story.timeline[episodeNumber]) {
        story.timeline[episodeNumber] = [];
      }
      story.timeline[episodeNumber].push(event);
    }
  }

  updateStoryFact(seriesId: string, fact: ContinuityFact): void {
    const story = this.stories.get(seriesId);
    if (!story) {
      this.addStory(seriesId, { facts: [fact] });
    } else {
      const existingIndex = story.facts.findIndex((f) => f.id === fact.id);
      if (existingIndex >= 0) {
        story.facts[existingIndex] = fact;
      } else {
        story.facts.push(fact);
      }
    }
  }

  getAllStories(): StoryDNA[] {
    return Array.from(this.stories.values());
  }

  clear(): void {
    this.stories.clear();
  }
}
