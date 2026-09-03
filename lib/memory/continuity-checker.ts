import type { ContinuityFact, ContinuityViolation, Shot } from '@/types';

export class ContinuityChecker {
  /**
   * Check if a continuity fact is active (valid) at a given episode, scene, and shot
   */
  private isFactActive(
    fact: ContinuityFact,
    episodeNumber: number,
    sceneNumber?: number
  ): boolean {
    // Check if we're before the valid from range
    if (episodeNumber < fact.validFromEpisode) {
      return false;
    }

    // Check if we're at the starting episode but before the starting scene/shot
    if (
      episodeNumber === fact.validFromEpisode &&
      fact.validFromScene !== undefined &&
      sceneNumber !== undefined &&
      sceneNumber < fact.validFromScene
    ) {
      return false;
    }

    // Check if we're after the valid to range
    if (fact.validToEpisode !== undefined && episodeNumber > fact.validToEpisode) {
      return false;
    }

    // Check if we're at the ending episode but after the ending scene/shot
    if (
      fact.validToEpisode === episodeNumber &&
      fact.validToScene !== undefined &&
      sceneNumber !== undefined &&
      sceneNumber > fact.validToScene
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get all active facts for a given episode, scene, shot
   */
  getActiveFacts(
    facts: ContinuityFact[],
    episodeNumber: number,
    sceneNumber?: number
  ): ContinuityFact[] {
    return facts.filter((fact) =>
      this.isFactActive(fact, episodeNumber, sceneNumber)
    );
  }

  /**
   * Check a shot for continuity violations
   */
  checkShot(
    shot: Shot,
    episodeNumber: number,
    sceneNumber: number,
    facts: ContinuityFact[]
  ): ContinuityViolation[] {
    const violations: ContinuityViolation[] = [];
    const activeFacts = this.getActiveFacts(facts, episodeNumber, sceneNumber);

    for (const requirement of shot.continuityRequirements) {
      const relevantFacts = activeFacts.filter(
        (fact) => fact.key === requirement.key
      );

      if (relevantFacts.length === 0) {
        // No fact found for this requirement - possible violation
        violations.push({
          id: `violation-${shot.id}-${requirement.key}`,
          episodeNumber,
          sceneNumber,
          shotNumber: shot.shotNumber,
          factId: `no-fact-${requirement.key}`,
          expectedValue: requirement.expectedValue,
          actualValue: 'UNKNOWN',
          severity: 'medium',
          description: `No continuity fact found for requirement: ${requirement.key}`,
          timestamp: new Date(),
        });
      } else {
        // Check if any fact matches the expected value
        const matchingFacts = relevantFacts.filter(
          (fact) => fact.value === requirement.expectedValue
        );

        if (matchingFacts.length === 0) {
          // Get the actual value from the first relevant fact
          const actualFact = relevantFacts[0];
          const severity =
            actualFact.confidence > 0.8
              ? 'high'
              : actualFact.confidence > 0.5
                ? 'medium'
                : 'low';

          violations.push({
            id: `violation-${shot.id}-${actualFact.id}`,
            episodeNumber,
            sceneNumber,
            shotNumber: shot.shotNumber,
            factId: actualFact.id,
            expectedValue: requirement.expectedValue,
            actualValue: actualFact.value,
            severity,
            description: `Expected ${requirement.key}="${requirement.expectedValue}", but continuity fact shows "${actualFact.value}"`,
            suggestedFix: `Update shot or override continuity fact for ${requirement.key}`,
            timestamp: new Date(),
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check multiple shots for continuity violations
   */
  checkShots(
    shots: Shot[],
    episodeNumber: number,
    sceneNumber: number,
    facts: ContinuityFact[]
  ): ContinuityViolation[] {
    const allViolations: ContinuityViolation[] = [];

    for (const shot of shots) {
      const shotViolations = this.checkShot(shot, episodeNumber, sceneNumber, facts);
      allViolations.push(...shotViolations);
    }

    return allViolations;
  }
}

export const createContinuityChecker = (): ContinuityChecker => {
  return new ContinuityChecker();
};
