import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FfmpegExportEngine, buildFfmpegArgs, type ExportProcessExecutor, type ExportWorkspace } from '@/lib/export/ffmpeg-engine';
import { MockExportEngine } from '@/lib/export/mock-engine';
import { getExportPreset } from '@/lib/export/presets';
import { validateMediaSource } from '@/lib/export/source-safety';
import type { ExportRenderRequest } from '@/lib/export/engine-types';

function request(videoUri = 'mock://output/clip.mp4', audioUri = 'mock://output/dialogue.mp3'): ExportRenderRequest { return { exportJobId: 'export-safe-1', preset: getExportPreset('vertical-social-1080p'), clips: [{ sequence: 1, videoUri, audioUri, startMs: 0, durationMs: 4000, trimInMs: 0, trimOutMs: 0, volume: 1, muted: false }], durationMs: 4000, captionMode: 'burn-in', captionFormat: 'srt', captionContent: '1\n00:00:00,000 --> 00:00:04,000\nSafe caption\n' }; }

describe('mock export engine', () => {
  it('has deterministic lifecycle, output, and cancellation', async () => {
    const first = new MockExportEngine(); const second = new MockExportEngine(); const a = await first.render(request()); const b = await second.render(request()); expect(a.jobId).toBe(b.jobId); expect(a.metadata).toEqual(b.metadata);
    expect((await first.getStatus(a.jobId)).status).toBe('processing'); const completed = await first.getStatus(a.jobId); expect(completed).toMatchObject({ status: 'succeeded', progress: 100, output: { mimeType: 'video/mp4', durationMs: 4000, checksum: expect.any(String) } });
    const cancellable = await second.render({ ...request(), exportJobId: 'export-safe-2' }); expect((await second.cancel(cancellable.jobId)).status).toBe('cancelled');
  });
});

describe('FFmpeg command generation and transport', () => {
  it('builds deterministic argument arrays for clips, dialogue, captions, and vertical output', () => {
    const args = buildFfmpegArgs({ clips: [{ videoSource: 'C:/managed/video.mp4', audioSource: 'C:/managed/audio.mp3', startMs: 0, durationMs: 4000, trimInMs: 250, volume: 0.8, muted: false }], durationMs: 4000, width: 1080, height: 1920, frameRate: 30, audioSampleRate: 48_000, captionPath: "C:/managed/caption's.srt", outputPath: 'C:/managed/output.mp4' });
    expect(args.slice(0, 9)).toEqual(['-y', '-nostdin', '-hide_banner', '-ss', '0.250', '-t', '4.000', '-i', 'C:/managed/video.mp4']);
    const filter = args[args.indexOf('-filter_complex') + 1]; expect(filter).toContain('scale=1080:1920'); expect(filter).toContain('concat=n=1:v=1:a=0'); expect(filter).toContain('amix=inputs=1'); expect(filter).toContain("subtitles='C\\:/managed/caption\\'s.srt'");
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']));
  });

  it('executes FFmpeg without a shell through injectable process/workspace boundaries', async () => {
    const calls: Array<{ executable: string; args: string[] }> = [];
    const executor: ExportProcessExecutor = { run: async (executable, args) => { calls.push({ executable, args }); return { exitCode: 0 }; } };
    const workspace: ExportWorkspace = { outputPath: async () => path.resolve('managed-output/export-safe-1.mp4'), writeCaption: async () => path.resolve('managed-output/export-safe-1-captions.srt'), complete: async () => ({ uri: 'managed://exports/export-safe-1.mp4', fileName: 'export-safe-1.mp4', mimeType: 'video/mp4', fileSize: 1234, durationMs: 4000, checksum: 'checksum' }) };
    const engine = new FfmpegExportEngine(path.resolve('managed-media'), executor, workspace, 'ffmpeg');
    const result = await engine.render(request('managed://media/video/clip.mp4', 'managed://media/audio/dialogue.mp3'));
    expect(result).toMatchObject({ status: 'succeeded', output: { uri: 'managed://exports/export-safe-1.mp4', checksum: 'checksum' } }); expect(calls).toHaveLength(1); expect(calls[0].executable).toBe('ffmpeg'); expect(calls[0].args).not.toContain('sh');
  });

  it('normalizes a non-zero FFmpeg exit without exposing process stderr', async () => {
    const engine = new FfmpegExportEngine(path.resolve('managed-media'), { run: async () => ({ exitCode: 1, stderr: 'C:/secret/media/token=do-not-expose' }) }, { outputPath: async () => path.resolve('managed-output/out.mp4'), writeCaption: async () => path.resolve('managed-output/captions.srt'), complete: async () => { throw new Error('must not complete'); } });
    const result = await engine.render(request('managed://media/video/clip.mp4', 'managed://media/audio/dialogue.mp3'));
    expect(result).toMatchObject({ status: 'failed', error: { code: 'processing_failed', message: 'FFmpeg rendering failed', retryable: true } }); expect(JSON.stringify(result)).not.toContain('do-not-expose');
  });

  it('rejects unsafe source schemes before process execution', async () => {
    expect(() => validateMediaSource('file:///etc/passwd', false)).toThrow('scheme'); expect(() => validateMediaSource('https://127.0.0.1/private.mp4', false)).toThrow('Private'); expect(() => validateMediaSource('https://[::1]/private.mp4', false)).toThrow('Private'); expect(() => validateMediaSource('https://user:secret@example.com/video.mp4', false)).toThrow('Credential'); expect(() => validateMediaSource('managed://media/%E0%A4%A', false)).toThrow('invalid');
    let executed = false; const engine = new FfmpegExportEngine(path.resolve('managed-media'), { run: async () => { executed = true; return { exitCode: 0 }; } }, { outputPath: async () => 'out.mp4', writeCaption: async () => 'captions.srt', complete: async () => ({ uri: 'managed://exports/out.mp4', fileName: 'out.mp4', mimeType: 'video/mp4', durationMs: 1 }) });
    expect((await engine.render(request('file:///unsafe.mp4', undefined))).error?.code).toBe('unsafe_source'); expect(executed).toBe(false);
  });
});
