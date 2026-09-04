import { DeterministicAgent } from '../base';
import type { AgentResponse, Screenplay, ShotPlan } from '../types';

export class DirectorAgent extends DeterministicAgent<Screenplay, ShotPlan> {
  readonly identity = 'director' as const;

  protected run(input: Screenplay): AgentResponse<ShotPlan> {
    const shots = input.scenes.flatMap((scene, index) => {
      const dialogue = scene.dialogue[0];
      return [{ id: `shot_${scene.id}_1`, sceneId: scene.id, sequence: index * 2 + 1, shotType: 'establishing', framing: 'medium', cameraDirection: 'slow push-in', characterIds: scene.dialogue.map((line) => line.characterId), locationId: scene.locationId, action: scene.action, dialogueReference: dialogue?.line, visualDescription: `Vertical 9:16 composition, ${scene.action}`, emotionalIntent: scene.emotionalBeat, estimatedDurationSeconds: 8, generationPrompt: `Cinematic Vertical 9:16 drama shot. ${scene.action}. ${scene.emotionalBeat}.`, continuityRequirements: scene.dialogue.some((line) => line.characterId === 'char_1_marcus') ? [{ key: 'marcus_wearing_rolex', expectedValue: 'false' }] : [] }, { id: `shot_${scene.id}_2`, sceneId: scene.id, sequence: index * 2 + 2, shotType: 'dialogue', framing: 'close-up', cameraDirection: 'locked portrait close-up', characterIds: scene.dialogue.map((line) => line.characterId), locationId: scene.locationId, action: 'Hold on the reaction before the cut.', dialogueReference: scene.dialogue.map((line) => `${line.characterId}: ${line.line}`).join(' | '), visualDescription: `Portrait close-up with negative space for captions. ${scene.emotionalBeat}`, emotionalIntent: scene.emotionalBeat, estimatedDurationSeconds: 10, generationPrompt: `Vertical 9:16 close-up. Reaction-driven microdrama performance. ${scene.emotionalBeat}`, continuityRequirements: [] }];
    });
    return { output: { episodeId: input.episodeId, aspectRatio: '9:16', shots, totalDurationSeconds: shots.reduce((sum, shot) => sum + shot.estimatedDurationSeconds, 0) }, confidence: 0.86, explanation: 'Built a portrait-first shot plan with readable dialogue beats and caption-safe framing.', warnings: [], metadata: { shotCount: shots.length, aspectRatio: '9:16' } };
  }
}
