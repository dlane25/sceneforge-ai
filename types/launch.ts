export type ReadinessScope = 'application' | 'series' | 'episode';
export type ReadinessCategory = 'application' | 'series-data' | 'episode-content' | 'provider-config' | 'storage' | 'export' | 'security-governance' | 'operations';
export type ReadinessSeverity = 'info' | 'warning' | 'error';
export type ReadinessStatus = 'pass' | 'warning' | 'fail' | 'not-applicable';

export interface ReadinessCheck {
  id: string;
  category: ReadinessCategory;
  severity: ReadinessSeverity;
  status: ReadinessStatus;
  explanation: string;
  remediation: string;
  affectedResource?: { type: string; id: string; label?: string };
  checkedAt: Date;
  blocking: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface ProductionReadinessReport {
  id: string;
  scope: ReadinessScope;
  seriesId?: string;
  episodeId?: string;
  checks: ReadinessCheck[];
  blockingCount: number;
  warningCount: number;
  passedCount: number;
  ready: boolean;
  checkedAt: Date;
}

export type OperationsJobKind = 'media-generation' | 'audio-generation' | 'episode-export';
export type OperationsClassification = 'awaiting-approval' | 'queued' | 'processing' | 'stale' | 'failed' | 'retryable' | 'cancelled' | 'completed';

export interface OperationsJob {
  id: string;
  kind: OperationsJobKind;
  seriesId: string;
  episodeId: string;
  sceneId?: string;
  shotId?: string;
  status: string;
  classifications: OperationsClassification[];
  progress?: number;
  retryCount: number;
  retryable: boolean;
  stale: boolean;
  staleReason?: 'approval-timeout' | 'queue-timeout' | 'processing-timeout';
  ageMs: number;
  updatedAt: Date;
  remediation: string;
  actionHref?: string;
}

export interface OperationsSummary {
  jobs: OperationsJob[];
  counts: Record<OperationsClassification, number>;
  thresholds: { approvalMs: number; queuedMs: number; processingMs: number };
  checkedAt: Date;
}

export interface DeliveryManifest {
  id: string;
  manifestVersion: '1.0';
  seriesId: string;
  episodeId: string;
  assemblyId: string;
  assemblyVersion: number;
  exportJobId: string;
  exportVersion: number;
  outputId: string;
  outputFormat: 'mp4';
  width: number;
  height: number;
  aspectRatio: '9:16';
  videoCodec: 'h264';
  audioCodec: 'aac';
  durationMs: number;
  fileSize: number;
  checksum: string;
  captionMode: 'none' | 'burn-in' | 'sidecar-srt' | 'sidecar-vtt';
  captionSidecarUri?: string;
  completedAt: Date;
  approvalState: 'approved';
  safeOutputUri: string;
  createdAt: Date;
}

export interface RightsAttestation {
  characterId: string;
  characterName: string;
  sourceType: string;
  rightsConfirmed: boolean;
  consentConfirmed: boolean;
  approvalState: string;
  satisfied: boolean;
}

export interface LaunchApprovalRecord {
  id: string;
  packageId: string;
  actorId: string;
  decision: 'approved' | 'rejected';
  note: string;
  decidedAt: Date;
}

export interface EpisodeLaunchPackage {
  id: string;
  seriesId: string;
  episodeId: string;
  version: number;
  inputHash: string;
  status: 'draft' | 'validated' | 'awaiting_approval' | 'launch_ready' | 'rejected';
  preferred: boolean;
  preparedBy: string;
  explanation: string;
  seriesTitle: string;
  episodeNumber: number;
  episodeTitle: string;
  manifest: DeliveryManifest;
  approvedAssetIds: string[];
  captionTrackId?: string;
  captionSidecarUri?: string;
  rightsAttestations: RightsAttestation[];
  approvalSummary: { assemblyApprovedBy?: string; exportApprovedBy?: string; launchApprovedBy?: string };
  continuitySummary: { checkedShots: number; blockingViolations: number; warningViolations: number };
  readinessSnapshot: ProductionReadinessReport;
  approvalHistory: LaunchApprovalRecord[];
  validatedAt?: Date;
  requestedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  supersededAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageReference {
  id: string;
  uri: string;
  visibility: 'private' | 'public';
  mimeType: string;
  size?: number;
  checksum?: string;
  exists: boolean;
  checkedAt: Date;
}
