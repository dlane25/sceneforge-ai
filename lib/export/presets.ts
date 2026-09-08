import type { ExportPreset, ExportPresetId } from '@/types';

export const EXPORT_PRESETS: Readonly<Record<ExportPresetId, ExportPreset>> = {
  'vertical-social-1080p': {
    id: 'vertical-social-1080p', label: 'Vertical Social 1080p', outputFormat: 'mp4', aspectRatio: '9:16',
    width: 1080, height: 1920, frameRate: 30, videoCodec: 'h264', audioCodec: 'aac', audioSampleRate: 48_000, pixelFormat: 'yuv420p',
  },
};

export function getExportPreset(id: string): ExportPreset {
  const preset = EXPORT_PRESETS[id as ExportPresetId];
  if (!preset) throw new Error(`Unsupported export preset: ${id}`);
  return preset;
}
