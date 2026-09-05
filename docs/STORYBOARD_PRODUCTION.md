# Storyboard Production

## Shot Architecture

Milestone 6 extends the existing `Scene -> Shot` hierarchy with a provider-neutral production shot contract. A shot belongs to a series, episode, and scene and carries:

- order and label
- shot type, angle, movement, and framing
- duration and dialogue/action context
- character and location references
- visual and negative prompts
- continuity notes
- lifecycle status

The domain does not contain vendor-specific video fields. Future providers consume a prepared shot prompt through existing provider contracts.

## Storyboard Architecture

Each shot can have one `Storyboard` record. The current implementation creates a deterministic placeholder with:

- `9:16` / `720x1280` dimensions
- prompt copied from the shot visual prompt
- `mock` provider identifier
- `placeholder` generation status
- version and timestamps

No image or video provider is called.

## Persistence

`ProductionDataRepository` now supports shot CRUD, reorder, and storyboard creation. The in-memory implementation provides deterministic local/test behavior. The Prisma implementation maps the same contract to the `Shot` and `Storyboard` models. No live migration is applied by this milestone.

Shot access always validates the full production, episode, and scene hierarchy. Reordering requires every shot in a scene exactly once. Shot numbers are unique within a scene.

## API Routes

- `GET/POST /api/series/[id]/episodes/[episodeId]/scenes/[sceneId]/shots`
- `GET/PATCH/DELETE /api/series/[id]/episodes/[episodeId]/scenes/[sceneId]/shots/[shotId]`
- `POST /api/series/[id]/episodes/[episodeId]/scenes/[sceneId]/shots/[shotId]/storyboard`
- `GET /api/series/[id]/episodes/[episodeId]/scenes/[sceneId]/shots/[shotId]/readiness`

All routes use authentication, membership authorization, Zod validation, and sanitized API errors.

## Generation Readiness

`ProductionService.getShotReadiness()` returns:

- `ready`
- blocking issues
- warnings
- evaluation timestamp

Required information includes a visual prompt, positive duration, and framing. Missing characters or location context are warnings so production can make an intentional decision. This is preparation only; approval and the existing generation gate remain authoritative before any consequential generation job.

## Continuity Integration

The shot model retains continuity requirements and notes. Persisted Series Memory facts remain the continuity authority. Future readiness checks can call the existing deterministic `ContinuityChecker` with repository-loaded active facts; no competing LLM continuity system is introduced.

## Orchestration Integration

`OrchestrationService` now asks the repository for persisted series data, Series Memory facts, story facts, and all persisted shots before constructing `AgentContext`. Agents still depend only on typed context and deterministic behavior, not Prisma. Demo fixtures remain fallback data when a persisted series is unavailable.

This means future Writer and Director adapters can consume real production records while the current milestone remains deterministic.

## Future Providers

A future storyboard/image provider can replace the placeholder service by implementing a provider-neutral adapter. It should update `Storyboard.generationStatus`, `provider`, `generationJobId`, `referenceUrl`, and `version` without changing shot domain contracts or UI routes.
