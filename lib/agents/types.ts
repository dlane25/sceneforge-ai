import type { Series, Shot, StoryFact } from '@/types';

export type AgentStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type AgentIdentity = 'showrunner' | 'writer' | 'director' | 'continuity' | 'scoring';

export interface AgentContext {
  series: Series;
  episodeId?: string;
  memory: SeriesMemorySnapshot;
  pipelineId?: string;
  productionData?: {
    shots: Shot[];
    storyFacts: StoryFact[];
  };
}

export interface SeriesMemorySnapshot {
  characterFacts: string[];
  worldFacts: string[];
  storyFacts: string[];
  continuityFacts: Array<{
    id: string;
    subjectId: string;
    key: string;
    value: string;
    validFromEpisode: number;
    validToEpisode?: number;
  }>;
  unresolvedThreads: string[];
}

export interface AgentRequest<TInput = unknown> {
  agent: AgentIdentity;
  input: TInput;
  context: AgentContext;
}

export interface AgentError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AgentResponse<TOutput> {
  output: TOutput;
  confidence?: number;
  explanation: string;
  warnings: string[];
  metadata: Record<string, string | number | boolean>;
}

export interface AgentExecution<TInput = unknown, TOutput = unknown> {
  id: string;
  agent: AgentIdentity;
  seriesId: string;
  episodeId?: string;
  input: TInput;
  output?: TOutput;
  status: AgentStatus;
  confidence?: number;
  explanation?: string;
  timestamp: Date;
  durationMs: number;
  errors: AgentError[];
  metadata: Record<string, string | number | boolean>;
}

export interface Agent<TInput, TOutput> {
  readonly identity: AgentIdentity;
  execute(request: AgentRequest<TInput>): Promise<AgentResponse<TOutput>>;
}

export interface CharacterConcept {
  name: string;
  role: string;
  desire: string;
  secret: string;
}

export interface WorldConcept {
  name: string;
  purpose: string;
  visualSignature: string;
}

export interface EpisodeOutline {
  episodeNumber: number;
  title: string;
  hook: string;
  synopsis: string;
  majorBeats: string[];
  cliffhanger: string;
}

export interface ShowrunnerOutput {
  title: string;
  logline: string;
  genre: string;
  tone: string;
  targetAudience: string;
  themes: string[];
  characterConcepts: CharacterConcept[];
  worldConcepts: WorldConcept[];
  seasonArc: string;
  episodeOutline: EpisodeOutline[];
  majorStoryBeats: string[];
  unresolvedStoryThreads: string[];
}

export interface ScreenplayDialogue {
  characterId: string;
  line: string;
}

export interface ScreenplayScene {
  id: string;
  sceneNumber: number;
  locationId: string;
  title: string;
  action: string;
  dialogue: ScreenplayDialogue[];
  emotionalBeat: string;
  revelation?: string;
}

export interface Screenplay {
  episodeId: string;
  openingHook: string;
  scenes: ScreenplayScene[];
  closingCliffhanger: string;
  estimatedDurationSeconds: number;
  memoryReferences: string[];
}

export interface DirectorShot {
  id: string;
  sceneId: string;
  sequence: number;
  shotType: string;
  framing: string;
  cameraDirection: string;
  characterIds: string[];
  locationId: string;
  action: string;
  dialogueReference?: string;
  visualDescription: string;
  emotionalIntent: string;
  estimatedDurationSeconds: number;
  generationPrompt: string;
  continuityRequirements: Array<{ key: string; expectedValue: string }>;
}

export interface ShotPlan {
  episodeId: string;
  aspectRatio: '9:16';
  shots: DirectorShot[];
  totalDurationSeconds: number;
}

export interface ContinuityFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  entityId: string;
  factId?: string;
  expectedValue: string;
  proposedValue: string;
  explanation: string;
  recommendedResolution: string;
}

export interface ContinuityReview {
  passed: boolean;
  findings: ContinuityFinding[];
  checkedFactCount: number;
}

export interface ScoringOutput {
  hookStrength: number;
  conflict: number;
  emotionalIntensity: number;
  cliffhanger: number;
  continuity: number;
  pacing: number;
  overall: number;
  recommendations: string[];
}
