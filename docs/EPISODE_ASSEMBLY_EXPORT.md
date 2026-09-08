# Episode Assembly and Export

Milestone 11 turns reviewed production media into a deterministic episode timeline and an approval-gated export package. It extends the existing production, repository, media-review, and caption boundaries; it does not give render engines direct access to Prisma or permission to choose assets.

## Assembly architecture

`EpisodeAssemblyService` loads the persisted episode, scenes, and shots, sorts scenes by `sceneNumber` and shots by `shotNumber`, then builds one immutable timeline item per shot. Each item records its scene and shot, selected video and dialogue-audio IDs, selection reasons, source durations, timeline start/end, trims, transition metadata, volume, mute state, and source-video-audio policy.

Timeline positions are cumulative and deterministic. A clip uses the approved video duration when available and otherwise the persisted shot duration. Rebuilding creates a new version only when the canonical input fingerprint changes. Prior versions and their review history remain intact.

The vertical social preset is domain configuration, not UI state:

- MP4 container
- 9:16 aspect ratio
- 1080 x 1920
- 30 fps
- H.264 video
- AAC audio at 48 kHz
- `yuv420p` pixel format

## Asset selection

Selection is independently scoped to `video` and `audio`:

1. preferred and approved asset;
2. otherwise the latest approved version;
3. otherwise unresolved.

Pending and rejected assets are never fallback candidates. The timeline records `preferred-approved` or `latest-approved` so reviewers can see why each source was chosen. Captions follow the same approved-preferred, then latest-approved rule within the episode.

## Validation

`validateAssemblyTimeline` produces stable typed errors and warnings. It checks:

- required video and generated dialogue audio;
- exact series, episode, scene, and shot ownership;
- asset media type, approval state, source safety, and positive duration;
- trim and timeline ranges;
- canonical ordering, gaps, and overlaps;
- audio-to-clip duration relationships;
- caption approval, ordering, and episode bounds;
- preset, aspect ratio, dimensions, frame rate, and total duration;
- the outstanding human approval state.

Errors block assembly approval and export creation. Warnings remain visible for review. Validation is deterministic and does not call an AI model.

## Versioning and review

Assemblies use deterministic episode-local version numbers and IDs. A matching input hash returns the existing non-rejected version instead of creating an accidental duplicate. A changed media selection, caption selection, duration, or ordering produces a new version. Approving or rejecting a version records actor, notes, state, and time. Only an approved, valid version may become preferred.

The governance sequence is:

`build -> validate -> owner approval -> preferred selection -> export preparation -> owner approval -> render -> normalized result`

Preparing an export has no render side effect. Only an owner can approve and start the job. Failed or cancelled jobs retry as a new export version that requires a fresh approval.

## Export engines

`ExportEngine` is a provider-neutral server contract for submission, status refresh, capability-aware cancellation, normalized output, and normalized errors.

`MockExportEngine` is deterministic and performs no network or process execution. It returns stable queued, processing, and completed states with normalized artifact metadata. It is the development/test default and is rejected in production.

`FfmpegExportEngine` is a genuine local process adapter. It uses an injectable process executor and workspace, allowing tests to verify the production boundary without requiring FFmpeg. The production executor launches the configured executable directly with `shell: false`; it never constructs a shell command string. Arguments are derived only from validated assembly and repository-owned asset metadata.

Local FFmpeg configuration is explicit:

```env
EXPORT_ENGINE=ffmpeg-local
FFMPEG_PATH=ffmpeg
EXPORT_MEDIA_ROOT=C:\absolute\managed-media
EXPORT_OUTPUT_ROOT=C:\absolute\exports
```

Both roots must be absolute. `EXPORT_MEDIA_ROOT` resolves `managed://media/...` inputs and prevents traversal outside that root. `EXPORT_OUTPUT_ROOT` contains staged caption and output artifacts. The browser receives only a managed public URI, never a server filesystem path.

## FFmpeg composition

The deterministic argument builder supports ordered inputs, trim-in/trim-out, video normalization, concatenation, generated dialogue placement, volume/mute, silence for shots without dialogue, AAC/H.264 encoding, vertical scaling and padding, and optional caption burn-in. Output names are generated from safe job identifiers.

Video source audio is always discarded. When approved generated dialogue exists, only that dialogue track is placed in the mix. This avoids unpredictable double audio. Shots without generated dialogue receive deterministic silence; a future reviewed policy can add source-audio preservation without changing the engine contract.

Supported caption modes are `none`, `burn-in`, `sidecar-srt`, and `sidecar-vtt`. Export always uses the approved caption track snapshotted by the assembly; it never writes new dialogue. Burn-in stages the validated track in the controlled export workspace. Sidecars preserve the existing SRT or WebVTT text and format.

## Source safety and errors

Accepted media sources are:

- `managed://media/...` paths resolved inside the configured managed-media root;
- credential-free HTTPS URLs whose literal host is not local or private;
- `mock://output/...` only when the selected engine explicitly allows mock sources.

File URLs, shell fragments, embedded URL credentials, traversal, local/private literal addresses, and unsupported schemes are rejected. The FFmpeg process uses an argument array with no shell interpolation. Browser errors expose normalized categories such as `configuration`, `invalid_request`, `processing_failed`, `source_missing`, and `unsafe_source`; they do not expose raw stderr, arguments, environment values, or server paths.

Audit events contain only safe identifiers, version, engine, preset, state, elapsed time, and normalized error category. They exclude asset URLs, caption/dialogue contents, process output, credentials, headers, and raw engine responses.

## API and UI

Authenticated nested routes are available under:

- `/api/series/[id]/episodes/[episodeId]/assembly`
- `/api/series/[id]/episodes/[episodeId]/assembly/[assemblyId]`
- `/api/series/[id]/episodes/[episodeId]/assembly/[assemblyId]/[action]`
- `/api/series/[id]/episodes/[episodeId]/exports`
- `/api/series/[id]/episodes/[episodeId]/exports/[jobId]`
- `/api/series/[id]/episodes/[episodeId]/exports/[jobId]/[action]`

Routes authenticate on the server, validate path/body values with Zod, and delegate hierarchy and role checks to the services. Viewers may read; owner decisions and consequential export operations require owner authorization.

The episode storyboard workspace embeds the assembly command center. It shows selected sources and reasons, timing/trims/audio policy, issues, captions, readiness, immutable versions, review actions, preset metadata, export lifecycle, retry/cancel, timestamps, and safe downloadable HTTPS output when present.

## Persistence

Repository contracts cover assemblies and export jobs with matching deterministic in-memory and Prisma implementations. Prisma uses explicit `EpisodeAssembly`, `EpisodeAssemblyItem`, `AssemblyValidationIssue`, and `EpisodeExportJob` models rather than hiding core state in JSON. JSON is limited to engine-specific normalized metadata.

Schema generation and validation are safe development operations. Milestone 11 does not run or ship a migration; operators must create and review the database migration separately before enabling Prisma persistence in an environment with existing data.

## Production limitations

The local adapter requires a compatible FFmpeg binary installed by the operator and accessible through `FFMPEG_PATH`. This repository does not bundle FFmpeg, download media, sign object URLs, create a cloud render farm, publish to social platforms, add a CDN, perform professional color work, or implement advanced music/SFX/DAW features. HTTPS inputs depend on the operator's FFmpeg build and network policy. Tests never run FFmpeg or call external providers.

## Production launch handoff

Milestone 12 requires the preferred assembly to remain approved/valid and its completed export to retain safe, complete metadata. A delivery manifest and final launch package snapshot those exact versions, captions, selected asset review states, approvals, rights, continuity summary, and readiness checks. A changed input produces a new package rather than mutating approved history. The production container installs FFmpeg intentionally and runs the same non-shell adapter as Milestone 11. See [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md).
