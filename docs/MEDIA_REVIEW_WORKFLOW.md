# Media Review Workflow

Milestone 8 adds deterministic human review for generated shot assets.

## Lifecycle

Completed generation creates an immutable `GeneratedAsset` with `reviewStatus: pending`. A reviewer submits an approved or rejected `MediaReview`; rejection requires a reason. Only approved assets may be selected as preferred. Selecting a replacement unsets and supersedes the former preferred version of the same asset type without deleting historical assets or reviews, so preferred audio and video can coexist for a shot.

## Persistence and Governance

`MediaReviewService` uses repository contracts and `ProductionService` authorization. Asset review, preference, and comparison validate the full series, episode, scene, shot, and asset hierarchy. Review approval checks the existing deterministic readiness/continuity result. Blocking issues prevent approval.

`GeneratedAsset` now includes parent/version/preferred/superseded metadata. `MediaReview` tracks actor, status, notes, rejection reason, continuity assessment, and timestamps.

## API

- `GET .../shots/[shotId]/assets`
- `GET .../assets/[assetId]/reviews`
- `POST .../assets/[assetId]/approve`
- `POST .../assets/[assetId]/reject`
- `POST .../assets/[assetId]/preferred`
- `POST .../assets/[assetId]/compare` with `compareWith`

## Storyboard UI

The shot production workspace includes media review for visual and audio versions. Reviewers explicitly load generation history, readiness, assets, and reviews. Audio review shows character, safe provider voice ID, provider/model, dialogue snapshot, lifecycle, duration, encoding metadata, cost, review state, and preferred marker. Playable URIs use browser audio controls; `mock://` assets render as safe metadata previews.

The panel exposes Approve, Reject, Mark Preferred, Compare Versions, and View History actions only when the state permits them. Approval is disabled when readiness reports blockers. Warnings and review notes/rejection reasons remain visible with the asset history. The comparison panel presents deterministic version metadata rather than attempting playback.

## Comparison

Comparison returns deterministic metadata for both versions: version, originating generation job, provider, duration, resolution, review state, and timestamps. Mock URIs are metadata placeholders, not playable media.

## Provider Harness

The `MediaProvider` contract defines estimate, generation, status, and capability-gated cancellation behavior. `MockMediaProvider` is the deterministic reference implementation; Gemini image and Vertex Veo adapters preserve the contract, normalize errors, and never bypass generation or asset review governance.

## Limitations

Milestone 11 assembly reads this immutable review history and accepts only approved assets; preferred selection remains scoped by media type. Rebuilding an assembly never rewrites or discards an asset review. See [EPISODE_ASSEMBLY_EXPORT.md](EPISODE_ASSEMBLY_EXPORT.md).

No advanced editing, uploads, billing, distribution, or external review notifications are included. Mock media remains metadata-only; production provider output is exposed as a safe URI and metadata without changing review governance.
