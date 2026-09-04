import { describe, expect, it } from 'vitest';
import type { Shot, ContinuityFact } from '@/types';
import { ContinuityChecker } from '@/lib/memory/continuity-checker';

const fact: ContinuityFact = {
  id: 'fact-watch',
  seriesId: 'series-1',
  subjectType: 'character',
  subjectId: 'marcus',
  key: 'watch',
  value: 'rolex',
  validFromEpisode: 1,
  validToEpisode: 3,
  source: 'costume notes',
  confidence: 0.95,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const shot: Shot = {
  id: 'shot-1',
  shotNumber: 1,
  sceneId: 'scene-1',
  framing: 'close-up',
  cameraMovement: 'static',
  description: 'Marcus checks his watch.',
  durationSeconds: 3,
  characterIds: ['marcus'],
  locationId: 'office',
  continuityRequirements: [{ key: 'watch', expectedValue: 'rolex' }],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('ContinuityChecker', () => {
  it('returns facts only while they are active in their time range', () => {
    const checker = new ContinuityChecker();

    expect(checker.getActiveFacts([fact], 2)).toEqual([fact]);
    expect(checker.getActiveFacts([fact], 4)).toEqual([]);
  });

  it('reports a mismatch against the active fact', () => {
    const checker = new ContinuityChecker();
    const violations = checker.checkShot(
      { ...shot, continuityRequirements: [{ key: 'watch', expectedValue: 'smartwatch' }] },
      2,
      1,
      [fact]
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      factId: 'fact-watch',
      expectedValue: 'smartwatch',
      actualValue: 'rolex',
      severity: 'high',
    });
  });
});
