export type ObservabilityEventName =
  | 'authentication_failure' | 'api_failure' | 'configuration_failure' | 'readiness_failure'
  | 'provider_call' | 'generation_lifecycle' | 'audio_lifecycle' | 'assembly_lifecycle'
  | 'export_lifecycle' | 'approval_decision'
  | 'launch_package_prepared' | 'launch_package_approved' | 'launch_package_rejected';

export interface ObservabilityEvent {
  event: ObservabilityEventName;
  requestId?: string;
  seriesId?: string;
  episodeId?: string;
  resourceId?: string;
  actorId?: string;
  status?: string;
  errorCode?: string;
  blockingCount?: number;
  warningCount?: number;
  durationMs?: number;
}

export interface ObservabilitySink { write(value: ObservabilityEvent): void }
export const consoleObservabilitySink: ObservabilitySink = { write(value) { const { event, requestId, seriesId, episodeId, resourceId, actorId, status, errorCode, blockingCount, warningCount, durationMs } = value; const entry = { event, requestId, seriesId, episodeId, resourceId, actorId, status, errorCode, blockingCount, warningCount, durationMs, timestamp: new Date().toISOString() }; if (errorCode || event.endsWith('failure')) console.error(JSON.stringify(entry)); else console.info(JSON.stringify(entry)); } };
export const silentObservabilitySink: ObservabilitySink = { write() {} };
