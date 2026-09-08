# Media Provider Pipeline

Milestones 7–9 provide a provider-neutral, approval-governed media lifecycle for persisted storyboard shots.

## Lifecycle

`storyboard-ready shot -> readiness -> awaiting_approval -> approved -> queued -> processing -> completed/failed/cancelled -> generated asset review`

`GenerationService` owns transitions. Preparation snapshots prompts and cost before approval. Only an owner can approve, start, cancel, reject, or retry a job. No provider call occurs before explicit approval.

## Provider Contract

`MediaProvider` accepts provider-neutral prompt, negative prompt, duration, aspect ratio, dimensions, seed, and continuity constraints. Capability discovery determines which operations are available; unsupported operations return typed errors rather than silently falling back.

`MockMediaProvider` is deterministic and performs no network work. Gemini image and Vertex Veo adapters use server-only production transports; tests inject fakes and make no network calls.

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

Production adapters submit only after owner approval and require explicit provider configuration. No billing, final render, or deployment is included. A Vertex output URI points at configured storage; this milestone does not upload or sign media URLs.
