export interface SceneSummary {
  sceneNumber: number;
}

export interface EpisodeWithScenes {
  id: string;
  scenes?: SceneSummary[];
}

export function nextSceneNumber(scenes: SceneSummary[] = []): number {
  return scenes.reduce((highest, scene) => Math.max(highest, scene.sceneNumber), 0) + 1;
}

export function buildSceneCreateInput(episode: EpisodeWithScenes | undefined, locationId: string) {
  if (!episode || !locationId) return undefined;

  return {
    sceneNumber: nextSceneNumber(episode.scenes),
    title: 'Opening beat',
    description: 'A new production scene.',
    locationId,
  };
}
