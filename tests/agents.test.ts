import { describe, expect, it } from 'vitest';
import { DirectorAgent, ShowrunnerAgent, WriterAgent } from '@/lib/agents';
import { createMemorySnapshot } from '@/lib/agents/memory-snapshot';
import { EMPIRE_OF_LIES_CONTINUITY_FACTS, EMPIRE_OF_LIES_SERIES, createEmpireOfLiesEpisodes } from '@/lib/mock';

const series = { ...EMPIRE_OF_LIES_SERIES, episodes: createEmpireOfLiesEpisodes() };
const context = { series, episodeId: 'ep_1', memory: createMemorySnapshot(series, EMPIRE_OF_LIES_CONTINUITY_FACTS) };

describe('deterministic agents', () => {
  it('showrunner produces structured production intelligence', async () => {
    const result = await new ShowrunnerAgent().execute({ agent: 'showrunner', input: { concept: series.logline }, context });
    expect(result.output.episodeOutline).toHaveLength(5);
    expect(result.output.characterConcepts).toHaveLength(4);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('writer produces a 60-90 second screenplay using memory references', async () => {
    const outline = { episodeNumber: 1, title: 'The Price of Power', hook: 'A perfect life shatters.', synopsis: 'Marcus faces a threat.', majorBeats: ['A call arrives.'], cliffhanger: 'The truth is at the door.' };
    const result = await new WriterAgent().execute({ agent: 'writer', input: outline, context });
    expect(result.output.estimatedDurationSeconds).toBeGreaterThanOrEqual(60);
    expect(result.output.estimatedDurationSeconds).toBeLessThanOrEqual(90);
    expect(result.output.scenes[0].dialogue.length).toBeGreaterThan(0);
    expect(result.output.memoryReferences.length).toBeGreaterThan(0);
  });

  it('director creates portrait-first 9:16 shots', async () => {
    const screenplay = await new WriterAgent().execute({ agent: 'writer', input: { episodeNumber: 1, title: 'The Price of Power', hook: 'A perfect life shatters.', synopsis: 'Marcus faces a threat.', majorBeats: ['A call arrives.'], cliffhanger: 'The truth is at the door.' }, context });
    const result = await new DirectorAgent().execute({ agent: 'director', input: screenplay.output, context });
    expect(result.output.aspectRatio).toBe('9:16');
    expect(result.output.shots.length).toBeGreaterThan(0);
    expect(result.output.shots[0].generationPrompt).toContain('Vertical 9:16');
  });
});
