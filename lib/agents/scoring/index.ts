import { calculateDramaScores } from '@/lib/ai/drama-scorer';
import { DeterministicAgent } from '../base';
import type { AgentContext, AgentResponse, ScoringOutput, Screenplay } from '../types';

export class ScoringAgent extends DeterministicAgent<Screenplay, ScoringOutput> {
  readonly identity = 'scoring' as const;

  protected run(input: Screenplay, context: AgentContext): AgentResponse<ScoringOutput> {
    const episode = context.series.episodes.find((item) => item.id === input.episodeId) || context.series.episodes[0];
    const score = calculateDramaScores(episode);
    const pacing = Math.max(0, Math.min(100, Math.round(100 - Math.abs(input.estimatedDurationSeconds - 75) * 2)));
    const overall = Math.round((score.hookStrength * 0.15 + score.conflict * 0.2 + score.emotionalIntensity * 0.2 + score.cliffhanger * 0.2 + score.characterContinuity * 0.1 + pacing * 0.15));
    const recommendations = [score.hookStrength < 70 ? 'Sharpen the opening image or question.' : '', score.cliffhanger < 70 ? 'End on a more specific irreversible choice.' : '', pacing < 70 ? 'Tighten the scene transitions for a 60-90 second runtime.' : ''].filter(Boolean);
    return { output: { hookStrength: score.hookStrength, conflict: score.conflict, emotionalIntensity: score.emotionalIntensity, cliffhanger: score.cliffhanger, continuity: score.characterContinuity, pacing, overall, recommendations }, confidence: 0.9, explanation: 'Applied the deterministic Milestone 1 scoring model and added pacing for the screenplay runtime.', warnings: [], metadata: { scoreVersion: 'milestone-2-v1' } };
  }
}
