# Media Provider Pipeline

Milestones 7–10 provide a provider-neutral, approval-governed media lifecycle for persisted storyboard shots and dialogue audio.

## Lifecycle

`storyboard-ready shot -> readiness -> awaiting_approval -> approved -> queued -> processing -> completed/failed/cancelled -> generated asset review`

Speech follows the same state machine from a persisted shot dialogue and character voice profile. A line or scene batch only prepares auditable jobs; provider submission still requires explicit owner approval per line.

`GenerationService` owns transitions. Preparation snapshots prompts and cost before approval. Only an owner can approve, start, cancel, reject, or retry a job. No provider call occurs before explicit approval.

## Provider Contract

`MediaProvider` accepts provider-neutral prompt, negative prompt, duration, aspect ratio, dimensions, seed, and continuity constraints. Capability discovery determines which operations are available; unsupported operations return typed errors rather than silently falling back.

`MockMediaProvider` is deterministic and performs no network work. Gemini image, Vertex Veo, and ElevenLabs voice adapters use server-only production transports; tests inject fakes and make no network calls.

## Persistence

`GenerationJob` persists hierarchy IDs, provider/job IDs, type, status, prompts/dialogue snapshots, duration, cost, retry/error information, and lifecycle timestamps. `GeneratedAsset` persists provider-neutral output metadata, fingerprint, version, and review status; audio adds voice ID, character, language, codec, sample rate, bitrate, channels, and source-text snapshot. Both use the existing repository contracts, with Prisma and in-memory adapters.

## Continuity and Readiness

Readiness is a structured result with blockers and warnings. Visual prompt, duration, and framing are blocking requirements. Character/location context and continuity notes surface as warnings. Series Memory remains the canonical continuity authority; readiness does not silently override conflicts.

## API

- `GET/POST .../shots/[shotId]/generation`
- `POST .../shots/[shotId]/generation/[jobId]/approve`
- `POST .../reject`
- `POST .../start`
- `POST .../refresh`
- `POST .../cancel`
- `POST .../retry`
- `GET/POST .../scenes/[sceneId]/audio`
- `POST .../scenes/[sceneId]/audio/[jobId]/[action]`
- `GET/POST .../episodes/[episodeId]/captions`

All endpoints enforce authenticated production hierarchy and use sanitized error responses.

## Episode assembly handoff

Milestone 11 consumes reviewed `GeneratedAsset` records without changing provider behavior. Its deterministic selector uses preferred-approved media first and otherwise the latest approved version, independently for video and audio. Provider adapters cannot place unreviewed output directly into an assembly or render job. See [EPISODE_ASSEMBLY_EXPORT.md](EPISODE_ASSEMBLY_EXPORT.md).

## Limitations

Production adapters submit only after owner approval and require explicit provider configuration. Milestone 11 adds basic local FFmpeg composition, but no music generation, SFX editor, audio upload library, advanced mix, billing, cloud rendering, distribution, or deployment. Provider output may be a data URI or configured storage URI; this milestone does not add durable binary-object storage or URL signing.

## Launch operations

Milestone 12 normalizes media and audio jobs with export jobs in the authenticated operations view. Stable stale thresholds identify old approvals, queues, and processing states without automatic mutation. Unresolved failed jobs and open approval gates block launch; retry remains limited, evidence-preserving, and reapproval-gated. See [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md).
