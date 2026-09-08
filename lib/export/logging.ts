import type { ExportErrorCode, ExportJobStatus, ExportPresetId } from '@/types';

export interface ExportLogEvent {
  operation: 'assemble' | 'validate' | 'approve' | 'submit' | 'refresh' | 'cancel' | 'complete';
  seriesId: string;
  episodeId: string;
  assemblyId?: string;
  assemblyVersion?: number;
  exportJobId?: string;
  engine?: string;
  preset?: ExportPresetId;
  status?: ExportJobStatus | 'validated';
  durationMs?: number;
  errorCode?: ExportErrorCode;
}
export interface ExportLogger { write(event: ExportLogEvent): void }
export const consoleExportLogger: ExportLogger = { write(event) { const entry = { event: 'episode_assembly_export', timestamp: new Date().toISOString(), ...event }; if (event.errorCode) console.error(JSON.stringify(entry)); else console.info(JSON.stringify(entry)); } };
export const silentExportLogger: ExportLogger = { write() {} };
