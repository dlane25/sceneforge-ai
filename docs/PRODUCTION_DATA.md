# Production Data Foundation

## Scope

Milestone 5 establishes persistent, production-scoped data for the vertical drama workflow:

- Characters
- Locations
- Episodes
- Scenes
- Continuity and story facts
- Relationships through production, episode, scene, and location references

The AI agents and deterministic continuity checker consume domain types and repository contracts, not Prisma directly.

## Data Model

A `Series` is the current production aggregate. It owns characters, locations, episodes, memory facts, story events, pipelines, and generation jobs.

`Episode` numbers are unique within a production. `Scene` numbers are unique within an episode. Scenes may reference a location only when that location belongs to the same production.

`SeriesMemoryFact` remains the structured time-scoped continuity record used by the deterministic checker. `StoryFact` captures narrative facts with optional episode/scene scope, category, source, confidence, and temporal bounds. Important query dimensions are explicit; flexible metadata is JSON.

## Repository and Service Architecture

`ProductionDataRepository` defines CRUD contracts for all production entities. `InMemoryPersistenceRepository` implements deterministic local/test behavior. `PrismaPersistenceRepository` maps the same contracts to PostgreSQL through Prisma.

`ProductionService` is authoritative for authorization and invariants:

- viewer access is required for reads
- editor access is required for content mutation
- owner access is required for membership and archive operations
- production IDs are checked through memberships
- duplicate episode/scene numbers are rejected
- foreign production locations and episodes are rejected

React components use API routes only. They never import Prisma or database credentials.

## API Surface

Characters:

- `GET/POST /api/series/[id]/characters`
- `GET/PATCH/DELETE /api/series/[id]/characters/[characterId]`

Locations:

- `GET/POST /api/series/[id]/locations`
- `GET/PATCH/DELETE /api/series/[id]/locations/[locationId]`

Episodes:

- `GET/POST /api/series/[id]/episodes`
- `GET/PATCH/DELETE /api/series/[id]/episodes/[episodeId]`

Scenes:

- `GET/POST /api/series/[id]/episodes/[episodeId]/scenes`
- `GET/PATCH/DELETE /api/series/[id]/episodes/[episodeId]/scenes/[sceneId]`

Continuity/story facts:

- `GET/POST /api/series/[id]/continuity`
- `GET/PATCH/DELETE /api/series/[id]/continuity/[factId]`

All bodies use Zod schemas and errors use the existing sanitized API error format.

## Series Memory Integration

The existing deterministic `ContinuityChecker` remains unchanged. Persistent continuity facts can be loaded through `SeriesMemoryRepository.getActiveFacts(seriesId, episodeNumber, sceneNumber, shotNumber)` and passed into the checker or agent memory snapshot. Story facts provide narrative chronology without replacing deterministic rules with an LLM.

## Local and Test Fallback

Without `DATABASE_URL`, runtime persistence uses the deterministic in-memory repository. Tests never require PostgreSQL. With `DATABASE_URL`, the runtime selects Prisma. No live database is touched by this milestone.

```bash
npm install
cp .env.example .env.local
npm test
```

## Migration Strategy

Generate and validate the client/schema safely:

```bash
npx prisma generate
npx prisma validate
```

When a reviewed local PostgreSQL connection is available, create a migration manually:

```bash
npx prisma migrate dev --name milestone-5-production-data
```

No reset, drop, or destructive migration is run automatically.
