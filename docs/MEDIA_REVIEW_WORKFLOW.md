# Media Review Workflow

Milestone 8 adds deterministic human review for generated shot assets.

## Lifecycle

Completed generation creates an immutable `GeneratedAsset` with `reviewStatus: pending`. A reviewer submits an approved or rejected `MediaReview`; rejection requires a reason. Only approved assets may be selected as preferred. Selecting a replacement unsets and supersedes the former preferred version without deleting historical assets or reviews.

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

The shot production workspace includes a Media Review panel for every shot. Reviewers explicitly load the shot's generation history, readiness result, assets, and reviews. Each asset displays version, provider, originating job, duration, resolution, created timestamp, review state, and preferred marker. `mock://` assets render as safe metadata previews.

The panel exposes Approve, Reject, Mark Preferred, Compare Versions, and View History actions only when the state permits them. Approval is disabled when readiness reports blockers. Warnings and review notes/rejection reasons remain visible with the asset history. The comparison panel presents deterministic version metadata rather than attempting playback.

## Comparison

Comparison returns deterministic metadata for both versions: version, originating generation job, provider, duration, resolution, review state, and timestamps. Mock URIs are metadata placeholders, not playable media.

## Provider Harness

The existing `VideoProvider` contract continues to define estimate, generation, status, and cancellation behavior. `MockVideoProvider` is the deterministic reference implementation. Future providers must preserve the contract, normalize errors, and never bypass generation or asset review governance.

## Limitations

No video playback, cloud storage, uploads, provider integration, final editing, or external review notifications are included. Media review UI expansion can consume these APIs without changing domain contracts.
