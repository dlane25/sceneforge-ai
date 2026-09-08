# Voice, Audio, and Captions

Milestone 10 extends SceneForge's existing provider-neutral media lifecycle. It does not introduce a separate approval or persistence system: character voices remain production data, speech uses `GenerationJob`, audio uses `GeneratedAsset`, and review uses the Milestone 8 `MediaReviewService`.

## Architecture and lifecycle

`AudioGenerationService` reads persisted `Series -> Episode -> Scene -> Shot` dialogue and the assigned character voice profile through `ProductionService`. Preparation resolves `AUDIO_PROVIDER` through `ProviderRegistry`, validates capabilities/configuration, estimates cost, and snapshots the dialogue, voice ID, language, model, provider controls, and input hash into an `awaiting_approval` job.

No provider operation occurs during preparation. An owner must approve each line before `start` may call `generateSpeech`. Synchronous providers complete immediately; asynchronous-capable providers may use the existing refresh lifecycle. Failures use the Milestone 9 normalized error categories. Completed jobs create versioned audio assets in `pending` review state. Approval, rejection, preference, retry, and regeneration preserve prior versions; preference is scoped by asset type so audio does not supersede video.

Scene batch preparation creates one approval-gated job per dialogue shot and skips lines that already have an active audio job. It never batch-approves or batch-submits.

## Voice profiles and rights

Character `VoiceProfile` stores provider-neutral creative controls and safe provider references: character/display identity, provider and provider voice ID, language/locale/accent, speaking style, tone, pitch/style/age/voice descriptors, pace, optional stability/similarity/style controls, reference metadata, activity, and timestamps. Series Memory remains authoritative for character identity and continuity.

`VoiceRightsMetadata` records `sourceType`, `rightsConfirmed`, `consentConfirmed`, owner rights note, confirmation time, reviewer, and approval state. Synthetic and provider-catalog voices may be marked not-required. Cloned, licensed, or uploaded-reference voices are blocked unless both rights and consent are confirmed, approval is `approved`, and a confirmation timestamp exists.

Reference metadata may contain an internal reference ID, MIME type, checksum, duration, and description. SceneForge does not store raw source audio in this milestone.

## Providers and configuration

Stable audio provider IDs are:

- `mock`: deterministic local/test speech with queued, processing, succeeded, and cancelled lifecycle states.
- `elevenlabs-voice`: synchronous ElevenLabs text-to-speech through the injectable server-only production transport.

The registry declares text-to-speech, speech generation, voice cloning, optional sound effects, and caption capabilities independently. The current adapters report cloning, sound effects, and provider caption generation as unsupported; unsupported calls return the shared typed error instead of falling back.

Local deterministic configuration:

```env
NODE_ENV=development
AUTH_MODE=mock
IMAGE_PROVIDER=mock
VIDEO_PROVIDER=mock
AUDIO_PROVIDER=mock
DEFAULT_AUDIO_LANGUAGE=en
```

Production ElevenLabs configuration:

```env
AUDIO_PROVIDER=elevenlabs-voice
ELEVENLABS_API_KEY=replace-outside-source-control
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
DEFAULT_AUDIO_LANGUAGE=en
```

`ELEVENLABS_API_ENDPOINT` is an optional controlled-environment override and must be an HTTPS `elevenlabs.io` URL. Production fails fast when the selected provider is mock or required configuration is missing. Credentials are accessed only from server code and must never use `NEXT_PUBLIC_*` names.

The production transport maps text, model, voice settings, language, and output format to ElevenLabs and normalizes returned bytes into a media URI with MIME type, checksum, file size, codec, sample rate, bitrate, channel count, request ID, duration when reported, and lifecycle metadata. Tests inject a fake HTTP client and make no network calls.

## Captions

`CaptionService` generates episode SRT and WebVTT tracks from persisted scene order, shot order, shot duration, dialogue, and the first assigned character. Silent shots still advance the timeline. Segment start/end values are exact deterministic offsets; no language model invents word timing. Provider transcript segments can use the same typed start/end/text/speaker/confidence shape in a future adapter.

Tracks and segments persist through repository contracts. Tracks record production hierarchy, language, format, source, generated/review timestamps, review notes, version, and preferred state. Only approved tracks can become preferred. Replacing the preferred track supersedes the prior track with the same language and format without deletion. Authenticated viewers may list or download `.srt`/`.vtt`; owners generate and review them.

## APIs and UI

- `GET/POST /api/series/[id]/episodes/[episodeId]/scenes/[sceneId]/audio`
- `POST /api/series/[id]/episodes/[episodeId]/scenes/[sceneId]/audio/[jobId]/[action]`
- `GET/POST /api/series/[id]/episodes/[episodeId]/captions`

All routes require server-side authentication, validate nested identifiers and bodies with Zod, authorize against production membership in services, and return sanitized API errors. The storyboard workspace integrates line/scene preparation, lifecycle actions, audio metadata/playback, asset review/preference, caption segments, track review/preference, and downloads. It exposes no provider credentials or raw provider payloads.

## Audit logging and limitations

Provider audit events include provider, model, safe voice/job/request identifiers, operation, status, elapsed time, and normalized error category. They exclude credentials, authorization headers, raw dialogue, raw audio, and raw provider responses.

Milestone 11 consumes approved preferred dialogue audio and caption tracks through repository contracts. Generated dialogue is aligned to its shot and replaces source-video audio deterministically; approved SRT/WebVTT can be omitted, burned in, or emitted as a sidecar. See [EPISODE_ASSEMBLY_EXPORT.md](EPISODE_ASSEMBLY_EXPORT.md).

The product still does not include music generation, a sound-effects library/editor, source-audio storage, word-level transcription, durable object storage, URL signing, a full multi-track DAW, advanced episode mixing, distribution, billing, deployment, or live database migration.

## Production launch gate

Milestone 12 treats cloned, licensed, and uploaded-reference voice rights/consent as an explicit series and episode blocker. Launch reports identify only character, source type, confirmations, review state, and remediation; reference material remains private. Final packages snapshot approved caption identity/sidecar and rights attestations so later changes create a new package version. See [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md).
