import 'server-only';

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExportEngine, ExportEngineResult, ExportRenderRequest } from './engine-types';
import { exportError, normalizeExportError } from './errors';
import { resolveManagedMediaSource, safeArtifactName, validateMediaSource } from './source-safety';

export interface ProcessResult { exitCode: number; stderr?: string }
export interface ExportProcessExecutor { run(executable: string, args: string[]): Promise<ProcessResult> }
export interface ExportWorkspace {
  outputPath(exportJobId: string): Promise<string>;
  writeCaption(exportJobId: string, format: 'srt' | 'vtt', content: string): Promise<string>;
  complete(outputPath: string, exportJobId: string, durationMs: number, captionMode: ExportRenderRequest['captionMode']): Promise<NonNullable<ExportEngineResult['output']>>;
}

export class SpawnProcessExecutor implements ExportProcessExecutor {
  async run(executable: string, args: string[]): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => { if (stderr.length < 4000) stderr += chunk.toString('utf8').slice(0, 4000 - stderr.length); });
      child.once('error', () => reject(exportError('configuration', 'FFmpeg could not be started')));
      child.once('close', (code) => resolve({ exitCode: code ?? -1, stderr }));
    });
  }
}

export class LocalExportWorkspace implements ExportWorkspace {
  constructor(private readonly outputRoot: string) {
    if (!path.isAbsolute(outputRoot)) throw exportError('configuration', 'Export output root must be an absolute managed path');
  }
  async outputPath(exportJobId: string): Promise<string> { await mkdir(this.outputRoot, { recursive: true }); return path.join(this.outputRoot, safeArtifactName(exportJobId, 'mp4')); }
  async writeCaption(exportJobId: string, format: 'srt' | 'vtt', content: string): Promise<string> { await mkdir(this.outputRoot, { recursive: true }); const file = path.join(this.outputRoot, safeArtifactName(`${exportJobId}-captions`, format)); await writeFile(file, content, { encoding: 'utf8', flag: 'wx' }); return file; }
  async complete(outputPath: string, exportJobId: string, durationMs: number, captionMode: ExportRenderRequest['captionMode']) {
    const [details, bytes] = await Promise.all([stat(outputPath), readFile(outputPath)]);
    const sidecarExtension = captionMode === 'sidecar-srt' ? 'srt' : captionMode === 'sidecar-vtt' ? 'vtt' : undefined;
    return {
      uri: `managed://exports/${safeArtifactName(exportJobId, 'mp4')}`,
      sidecarUri: sidecarExtension ? `managed://exports/${safeArtifactName(`${exportJobId}-captions`, sidecarExtension)}` : undefined,
      fileName: safeArtifactName(exportJobId, 'mp4'), mimeType: 'video/mp4' as const, fileSize: details.size, durationMs,
      checksum: createHash('sha256').update(bytes).digest('hex'), metadata: { engine: 'ffmpeg-local' },
    };
  }
}

export interface FfmpegCommandPlan {
  clips: Array<{ videoSource: string; audioSource?: string; startMs: number; durationMs: number; trimInMs: number; volume: number; muted: boolean }>;
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
  audioSampleRate: number;
  captionPath?: string;
  outputPath: string;
}

function seconds(value: number): string { return (value / 1000).toFixed(3); }
function escapeFilterPath(value: string): string { return value.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/,/g, '\\,').replace(/;/g, '\\;'); }

export function buildFfmpegArgs(plan: FfmpegCommandPlan): string[] {
  if (!plan.clips.length || plan.durationMs <= 0) throw exportError('validation_failed', 'FFmpeg requires a non-empty validated timeline');
  const args: string[] = ['-y', '-nostdin', '-hide_banner'];
  for (const clip of plan.clips) args.push('-ss', seconds(clip.trimInMs), '-t', seconds(clip.durationMs), '-i', clip.videoSource);
  const audioClips = plan.clips.filter((clip) => clip.audioSource && !clip.muted);
  for (const clip of audioClips) args.push('-i', clip.audioSource!);
  const filters: string[] = [];
  plan.clips.forEach((clip, index) => filters.push(`[${index}:v]trim=duration=${seconds(clip.durationMs)},setpts=PTS-STARTPTS,scale=${plan.width}:${plan.height}:force_original_aspect_ratio=decrease,pad=${plan.width}:${plan.height}:(ow-iw)/2:(oh-ih)/2,fps=${plan.frameRate},format=yuv420p[v${index}]`));
  filters.push(`${plan.clips.map((_, index) => `[v${index}]`).join('')}concat=n=${plan.clips.length}:v=1:a=0[vcat]`);
  if (plan.captionPath) filters.push(`[vcat]subtitles='${escapeFilterPath(plan.captionPath)}'[vout]`);
  audioClips.forEach((clip, index) => {
    const inputIndex = plan.clips.length + index;
    filters.push(`[${inputIndex}:a]atrim=duration=${seconds(clip.durationMs)},asetpts=PTS-STARTPTS,volume=${clip.volume.toFixed(3)},adelay=${clip.startMs}|${clip.startMs}[a${index}]`);
  });
  if (audioClips.length) filters.push(`${audioClips.map((_, index) => `[a${index}]`).join('')}amix=inputs=${audioClips.length}:duration=longest:normalize=0,atrim=duration=${seconds(plan.durationMs)}[aout]`);
  else filters.push(`anullsrc=r=${plan.audioSampleRate}:cl=stereo,atrim=duration=${seconds(plan.durationMs)}[aout]`);
  args.push('-filter_complex', filters.join(';'), '-map', plan.captionPath ? '[vout]' : '[vcat]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(plan.frameRate), '-c:a', 'aac', '-ar', String(plan.audioSampleRate), '-movflags', '+faststart', '-t', seconds(plan.durationMs), plan.outputPath);
  return args;
}

export class FfmpegExportEngine implements ExportEngine {
  readonly id = 'ffmpeg-local' as const;
  readonly capabilities = { asynchronous: false, cancellation: false, captionBurnIn: true, captionSidecar: true };
  private readonly results = new Map<string, ExportEngineResult>();
  constructor(private readonly mediaRoot: string, private readonly executor: ExportProcessExecutor, private readonly workspace: ExportWorkspace, private readonly executable = 'ffmpeg') {}

  async render(request: ExportRenderRequest): Promise<ExportEngineResult> {
    const jobId = `ffmpeg-${request.exportJobId}`;
    try {
      const clips = request.clips.map((clip) => {
        validateMediaSource(clip.videoUri, false); if (clip.audioUri) validateMediaSource(clip.audioUri, false);
        return { ...clip, videoSource: resolveManagedMediaSource(clip.videoUri, this.mediaRoot), audioSource: clip.audioUri ? resolveManagedMediaSource(clip.audioUri, this.mediaRoot) : undefined };
      });
      const outputPath = await this.workspace.outputPath(request.exportJobId);
      const captionPath = request.captionMode === 'burn-in' && request.captionContent && request.captionFormat ? await this.workspace.writeCaption(request.exportJobId, request.captionFormat, request.captionContent) : undefined;
      if (request.captionMode === 'burn-in' && !captionPath) throw exportError('validation_failed', 'Burn-in captions require approved caption content');
      if (request.captionMode.startsWith('sidecar') && request.captionContent && request.captionFormat) await this.workspace.writeCaption(request.exportJobId, request.captionFormat, request.captionContent);
      const args = buildFfmpegArgs({ clips: clips.map((clip) => ({ videoSource: clip.videoSource, audioSource: clip.audioSource, startMs: clip.startMs, durationMs: clip.durationMs, trimInMs: clip.trimInMs, volume: clip.volume, muted: clip.muted })), durationMs: request.durationMs, width: request.preset.width, height: request.preset.height, frameRate: request.preset.frameRate, audioSampleRate: request.preset.audioSampleRate, captionPath, outputPath });
      const process = await this.executor.run(this.executable, args);
      if (process.exitCode !== 0) throw exportError('processing_failed', 'FFmpeg rendering failed', true);
      const output = await this.workspace.complete(outputPath, request.exportJobId, request.durationMs, request.captionMode);
      const result: ExportEngineResult = { jobId, status: 'succeeded', progress: 100, output, metadata: { argumentCount: args.length, synchronous: true } };
      this.results.set(jobId, result); return structuredClone(result);
    } catch (cause) {
      const error = normalizeExportError(cause);
      const result: ExportEngineResult = { jobId, status: 'failed', progress: 0, error };
      this.results.set(jobId, result); return structuredClone(result);
    }
  }
  async getStatus(jobId: string): Promise<ExportEngineResult> { const result = this.results.get(jobId); if (!result) throw exportError('source_missing', 'FFmpeg export result was not found'); return structuredClone(result); }
  async cancel(): Promise<ExportEngineResult> { throw exportError('unsupported', 'Synchronous FFmpeg export cancellation is unsupported'); }
}
