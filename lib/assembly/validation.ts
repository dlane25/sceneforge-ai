import type { AssemblyIssueCode, AssemblyValidationIssue, CaptionTrack, EpisodeAssembly, GeneratedAsset } from '@/types';
import { EXPORT_PRESETS } from '@/lib/export/presets';
import { validateMediaSource } from '@/lib/export/source-safety';

export interface AssemblyValidationContext { assets: Map<string, GeneratedAsset>; captionTrack?: CaptionTrack }

export function validateAssemblyTimeline(assembly: EpisodeAssembly, context: AssemblyValidationContext): AssemblyValidationIssue[] {
  const issues: AssemblyValidationIssue[] = [];
  const add = (code: AssemblyIssueCode, severity: 'error' | 'warning', message: string, item?: EpisodeAssembly['items'][number], assetId?: string) => issues.push({ id: `${assembly.id}_issue_${issues.length + 1}`, assemblyId: assembly.id, code, severity, message, sequence: item?.sequence, sceneId: item?.sceneId, shotId: item?.shotId, assetId });
  const items = [...assembly.items].sort((a, b) => a.sequence - b.sequence);
  if (!items.length) add('EMPTY_TIMELINE', 'error', 'Episode has no timeline items to export.');
  let previousEnd = 0;
  items.forEach((item, index) => {
    if (item.sequence !== index + 1) add('TIMELINE_ORDER', 'error', 'Timeline sequence must be contiguous and start at one.', item);
    if (item.startMs < 0 || item.endMs <= item.startMs) add('INVALID_TIME_RANGE', 'error', 'Timeline item must have a non-negative start and an end after its start.', item);
    if (item.trimInMs < 0 || item.trimOutMs < 0 || (item.sourceVideoDurationMs !== undefined && item.trimInMs + item.trimOutMs >= item.sourceVideoDurationMs)) add('INVALID_TRIM', 'error', 'Video trim values must be non-negative and shorter than the source clip.', item, item.videoAssetId);
    if (item.sourceVideoDurationMs !== undefined && item.endMs - item.startMs !== item.sourceVideoDurationMs - item.trimInMs - item.trimOutMs) add('INVALID_VIDEO_DURATION', 'error', 'Timeline clip duration must match the source duration after trims.', item, item.videoAssetId);
    if (index > 0 && item.startMs < previousEnd) add('TIMELINE_OVERLAP', 'error', 'Timeline item overlaps the preceding clip.', item);
    if (item.startMs > previousEnd) add('TIMELINE_GAP', 'error', 'Timeline item leaves an unintended gap after the preceding clip.', item);
    previousEnd = Math.max(previousEnd, item.endMs);

    if (!item.videoAssetId) add('MISSING_VIDEO', 'error', 'Select an approved video asset for this shot.', item);
    else validateAsset(item.videoAssetId, 'video-clip', 'INVALID_VIDEO_DURATION', item, assembly, context, add);
    if (item.dialogueRequired && !item.audioAssetId) add('MISSING_DIALOGUE_AUDIO', 'error', 'Generate and approve dialogue audio for this shot.', item);
    else if (item.audioAssetId) validateAsset(item.audioAssetId, 'audio', 'INVALID_AUDIO_DURATION', item, assembly, context, add);
    if (item.sourceAudioDurationMs !== undefined && item.sourceAudioDurationMs > item.endMs - item.startMs + 100) add('AUDIO_EXCEEDS_CLIP', 'error', 'Dialogue audio extends beyond its video clip.', item, item.audioAssetId);
    if (item.sourceAudioDurationMs !== undefined && item.sourceAudioDurationMs + 250 < item.endMs - item.startMs) add('AUDIO_SHORTER_THAN_CLIP', 'warning', 'Dialogue audio ends before the video clip.', item, item.audioAssetId);
  });
  if (assembly.timelineDurationMs <= 0 || (items.length && assembly.timelineDurationMs !== items[items.length - 1].endMs)) add('INVALID_TIME_RANGE', 'error', 'Timeline duration must match the final clip end.');
  const preset = EXPORT_PRESETS[assembly.exportPreset];
  if (!preset || preset.width !== assembly.width || preset.height !== assembly.height || preset.frameRate !== assembly.frameRate) add('INVALID_EXPORT_PRESET', 'error', 'Assembly output settings do not match the selected export preset.');
  if (assembly.aspectRatio !== '9:16' || assembly.width * 16 !== assembly.height * 9) add('INVALID_ASPECT_RATIO', 'error', 'SceneForge episode exports must use a 9:16 frame.');
  if (assembly.captionIncluded) {
    const track = context.captionTrack;
    if (!track || track.id !== assembly.captionTrackId || track.reviewStatus !== 'approved') add('CAPTION_NOT_APPROVED', 'error', 'Caption inclusion requires an approved caption track.');
    else {
      let previousCaptionEnd = 0;
      for (const segment of [...track.segments].sort((a, b) => a.sequence - b.sequence)) {
        if (segment.startMs < previousCaptionEnd || segment.endMs <= segment.startMs) add('CAPTION_ORDER', 'error', 'Caption segments must be ordered and non-overlapping.');
        if (segment.startMs < 0 || segment.endMs > assembly.timelineDurationMs) add('CAPTION_OUT_OF_RANGE', 'error', 'Caption segment falls outside the episode timeline.');
        previousCaptionEnd = Math.max(previousCaptionEnd, segment.endMs);
      }
    }
  }
  if (assembly.reviewState !== 'approved') add('APPROVAL_PENDING', 'warning', 'Human approval is required before export execution.');
  return issues;
}

function validateAsset(
  assetId: string,
  expectedType: 'video-clip' | 'audio',
  durationCode: 'INVALID_VIDEO_DURATION' | 'INVALID_AUDIO_DURATION',
  item: EpisodeAssembly['items'][number],
  assembly: EpisodeAssembly,
  context: AssemblyValidationContext,
  add: (code: AssemblyIssueCode, severity: 'error' | 'warning', message: string, item?: EpisodeAssembly['items'][number], assetId?: string) => void,
): void {
  const asset = context.assets.get(assetId);
  if (!asset || asset.seriesId !== assembly.seriesId || asset.episodeId !== assembly.episodeId || asset.sceneId !== item.sceneId || asset.shotId !== item.shotId || asset.assetType !== expectedType) { add('ASSET_SCOPE_MISMATCH', 'error', `Selected ${expectedType} asset does not belong to this timeline shot.`, item, assetId); return; }
  if (asset.reviewStatus === 'rejected') add('REJECTED_ASSET', 'error', 'Rejected assets cannot be assembled.', item, assetId);
  else if (asset.reviewStatus !== 'approved') add('REJECTED_ASSET', 'error', 'Only approved assets can be assembled.', item, assetId);
  if (!asset.durationSeconds || asset.durationSeconds <= 0) add(durationCode, 'error', `${expectedType} asset requires a positive duration.`, item, assetId);
  try { validateMediaSource(asset.storageUri || asset.uri, true); } catch { add('UNSAFE_SOURCE', 'error', 'Selected asset uses an unsupported or unsafe media source.', item, assetId); }
}
