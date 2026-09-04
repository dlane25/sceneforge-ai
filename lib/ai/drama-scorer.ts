import type { Episode, DramaScore } from '@/types';

export interface DramaScoringInput {
  hookStrength: number; // 0-100
  conflict: number; // 0-100
  emotionalIntensity: number; // 0-100
  cliffhangerStrength: number; // 0-100
  characterContinuityScore: number; // 0-100
}

/**
 * Calculate individual drama score component
 * Ensures values stay within 0-100 range
 */
function constrainScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Calculate deterministic scores based on episode text/structure
 */
export function calculateDramaScores(episode: Episode): DramaScore {
  // Calculate hook strength from hook length and content
  const hookLength = episode.hook.length;
  const hookStrength = constrainScore(Math.min(100, (hookLength / 50) * 100));

  // Calculate conflict from synopsis
  const conflictKeywords = ['betrayal', 'confrontation', 'rival', 'enemy', 'deceive', 'manipulate'];
  const conflictMatches = conflictKeywords.filter((kw) =>
    episode.synopsis.toLowerCase().includes(kw)
  ).length;
  const conflict = constrainScore(50 + conflictMatches * 10);

  // Calculate emotional intensity from word count and sentiment
  const words = episode.synopsis.split(/\s+/).length;
  const emotionalKeywords = [
    'love',
    'hate',
    'desperate',
    'passion',
    'heartbreak',
    'shattered',
    'impossible',
  ];
  const emotionalMatches = emotionalKeywords.filter((kw) =>
    episode.synopsis.toLowerCase().includes(kw)
  ).length;
  const emotionalIntensity = constrainScore(30 + (words / 2) * 0.5 + emotionalMatches * 15);

  // Calculate cliffhanger from cliffhanger text
  const cliffhangerLength = episode.cliffhanger.length;
  const cliffhangerScore = constrainScore(Math.min(100, (cliffhangerLength / 40) * 100));

  // Calculate character continuity based on references
  const characterContinuity = 75; // Baseline for demo

  // Calculate overall score as weighted average
  const overall = constrainScore(
    (hookStrength * 0.15 +
      conflict * 0.25 +
      emotionalIntensity * 0.25 +
      cliffhangerScore * 0.25 +
      characterContinuity * 0.1) /
      1
  );

  return {
    hookStrength: constrainScore(hookStrength),
    conflict: constrainScore(conflict),
    emotionalIntensity: constrainScore(emotionalIntensity),
    cliffhanger: constrainScore(cliffhangerScore),
    characterContinuity: constrainScore(characterContinuity),
    overall: constrainScore(overall),
    timestamp: new Date(),
  };
}

/**
 * Calculate drama score from explicit input values
 */
export function calculateDramaScoreFromInput(input: DramaScoringInput): DramaScore {
  const overall = constrainScore(
    (input.hookStrength * 0.15 +
      input.conflict * 0.25 +
      input.emotionalIntensity * 0.25 +
      input.cliffhangerStrength * 0.25 +
      input.characterContinuityScore * 0.1) /
      1
  );

  return {
    hookStrength: constrainScore(input.hookStrength),
    conflict: constrainScore(input.conflict),
    emotionalIntensity: constrainScore(input.emotionalIntensity),
    cliffhanger: constrainScore(input.cliffhangerStrength),
    characterContinuity: constrainScore(input.characterContinuityScore),
    overall,
    timestamp: new Date(),
  };
}

/**
 * Get drama score interpretation
 */
export function interpretDramaScore(score: number): string {
  if (score >= 80) return 'Exceptional - Highly engaging episode';
  if (score >= 70) return 'Strong - Well-crafted episode';
  if (score >= 60) return 'Good - Solid episode';
  if (score >= 50) return 'Fair - Needs improvement';
  if (score >= 40) return 'Weak - Requires significant revision';
  return 'Poor - Major rework needed';
}

/**
 * Batch calculate scores for multiple episodes
 */
export function calculateBatchDramaScores(episodes: Episode[]): Map<string, DramaScore> {
  const scores = new Map<string, DramaScore>();

  for (const episode of episodes) {
    scores.set(episode.id, calculateDramaScores(episode));
  }

  return scores;
}
