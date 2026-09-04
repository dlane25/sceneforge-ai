import { describe, expect, it } from 'vitest';
import type { Episode } from '@/types';
import { calculateDramaScoreFromInput, calculateDramaScores } from '@/lib/ai/drama-scorer';

const episode: Episode = {
  id: 'episode-1',
  seriesId: 'series-1',
  episodeNumber: 1,
  title: 'The Betrayal',
  hook: 'A billionaire discovers an impossible betrayal.',
  synopsis: 'A rival confronts the family after a betrayal leaves their empire shattered.',
  scenes: [],
  cliffhanger: 'The rival reveals he has proof and will expose everything tonight.',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('drama scorer', () => {
  it('returns component scores and a weighted overall score in range', () => {
    const score = calculateDramaScores(episode);

    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(score.conflict).toBeGreaterThan(50);
    expect(score.emotionalIntensity).toBeGreaterThan(30);
  });

  it('clamps explicit inputs and applies the documented weights', () => {
    const score = calculateDramaScoreFromInput({
      hookStrength: 120,
      conflict: -10,
      emotionalIntensity: 80,
      cliffhangerStrength: 60,
      characterContinuityScore: 40,
    });

    expect(score).toMatchObject({
      hookStrength: 100,
      conflict: 0,
      emotionalIntensity: 80,
      cliffhanger: 60,
      characterContinuity: 40,
      overall: 55,
    });
  });
});
