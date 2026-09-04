import { ContinuityChecker } from '@/lib/memory/continuity-checker';
import { DeterministicAgent } from '../base';
import type { AgentContext, AgentResponse, ContinuityReview, DirectorShot, Screenplay, ShotPlan } from '../types';
import type { Shot } from '@/types';

export interface ContinuityInput { screenplay: Screenplay; shotPlan: ShotPlan; }

export class ContinuityAgent extends DeterministicAgent<ContinuityInput, ContinuityReview> {
  readonly identity = 'continuity' as const;

  protected run(input: ContinuityInput, context: AgentContext): AgentResponse<ContinuityReview> {
    const checker = new ContinuityChecker();
    const findings = input.shotPlan.shots.flatMap((shot: DirectorShot) => {
      const legacyShot: Shot = { id: shot.id, shotNumber: shot.sequence, sceneId: shot.sceneId, framing: shot.framing as Shot['framing'], cameraMovement: 'static', description: shot.visualDescription, dialogue: shot.dialogueReference, durationSeconds: shot.estimatedDurationSeconds, characterIds: shot.characterIds, locationId: shot.locationId, continuityRequirements: shot.continuityRequirements, createdAt: new Date(), updatedAt: new Date() };
      return checker.checkShot(legacyShot, context.series.episodes.find((episode) => episode.id === input.screenplay.episodeId)?.episodeNumber || 1, 1, context.memory.continuityFacts.map((fact) => ({ ...fact, seriesId: context.series.id, subjectType: 'character' as const, source: 'series-memory', confidence: 0.9, createdAt: new Date(), updatedAt: new Date() }))).map((violation) => ({ severity: violation.severity, entityId: shot.id, factId: violation.factId, expectedValue: violation.expectedValue, proposedValue: violation.actualValue, explanation: violation.description, recommendedResolution: violation.suggestedFix || 'Confirm the requirement against Series Memory.' }));
    });
    return { output: { passed: findings.length === 0, findings, checkedFactCount: context.memory.continuityFacts.length }, confidence: 0.94, explanation: findings.length ? `Found ${findings.length} continuity finding(s); canon was not modified.` : 'Checked the screenplay and shot plan against active Series Memory facts.', warnings: findings.length ? ['Human review is recommended before generation.'] : [], metadata: { findingCount: findings.length } };
  }
}
