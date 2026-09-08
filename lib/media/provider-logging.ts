import type { NormalizedProviderError, ProviderLifecycleStatus } from './providers/types';

export interface ProviderLogEvent {
  operation: 'submit' | 'poll' | 'cancel' | 'complete';
  provider: string;
  model?: string;
  voiceId?: string;
  generationJobId?: string;
  providerJobId?: string;
  status?: ProviderLifecycleStatus | 'polling_error';
  durationMs?: number;
  error?: Pick<NormalizedProviderError, 'code' | 'retryable'>;
}

export interface ProviderLogger { write(event: ProviderLogEvent): void }

export const consoleProviderLogger: ProviderLogger = {
  write(event) {
    const entry = { event: 'media_provider_operation', timestamp: new Date().toISOString(), ...event };
    if (event.error) console.error(JSON.stringify(entry));
    else console.info(JSON.stringify(entry));
  },
};

export const silentProviderLogger: ProviderLogger = { write() {} };
