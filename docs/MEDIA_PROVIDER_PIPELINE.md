# Media Provider Pipeline

Milestone 7 adds a provider-neutral, approval-governed media lifecycle for persisted storyboard shots.

## Lifecycle

`storyboard-ready shot -> readiness -> awaiting_approval -> approved -> queued -> processing -> completed/failed/cancelled -> generated asset review`

`GenerationService` owns transitions. Preparation snapshots prompts and cost before approval. Only an owner can approve, start, cancel, reject, or retry a job. No provider call occurs before explicit approval.

## Provider Contract

`VideoProvider` accepts production hierarchy IDs, prompt snapshots, negative prompt, duration, aspect ratio, dimensions, seed, continuity constraints, and camera metadata without vendor coupling. It supports generate, image-to-video, extension, status, cancel, and estimate-cost operations.

`MockVideoProvider` is deterministic and performs no network work. It yields mock asset URIs and predictable queued/running/completed status progression.

## Persistence

`GenerationJob` persists hierarchy IDs, provider/job IDs, type, status, prompts, duration, cost, retry/error information, and lifecycle timestamps. `GeneratedAsset` persists provider-neutral output metadata, fingerprint, version, and review status. Both use the existing repository contracts, with Prisma and in-memory adapters.

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

All endpoints enforce authenticated production hierarchy and use sanitized error responses.

## Limitations

No real provider, upload, billing, final render, or cloud asset storage is included. Generated assets are deterministic `mock://` placeholders. A future provider adapter can implement the current contract and update job/asset state without changing service or domain APIs.
