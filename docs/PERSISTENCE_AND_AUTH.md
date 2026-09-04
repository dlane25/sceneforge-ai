# Persistence and Authentication

## What Is Implemented

Milestone 3 replaces the Milestone 2 process-local pipeline map with repository contracts:

- `PersistenceRepository` is the server-side boundary for users, memberships, pipelines, executions, approvals, and Series Memory facts.
- `InMemoryPersistenceRepository` is deterministic and is used when `DATABASE_URL` is absent, keeping unit tests and local demos database-free.
- `PrismaPersistenceRepository` maps the same contract to PostgreSQL through Prisma.
- `runtimeRepository` selects Prisma when `DATABASE_URL` is configured and otherwise selects the in-memory adapter.
- `lib/db/client.ts` is the single Prisma client entry point. It is imported only by server-side repository code.

The domain and orchestration layers depend on repository contracts rather than Prisma models.

## Database Architecture

`prisma/schema.prisma` contains normalized models for:

- `User`
- `Series`
- `ProductionMembership`
- `Character`, `Location`, `Episode`, `Scene`, and `Shot`
- `SeriesMemoryFact` and `StoryEvent`
- `PipelineRun`, `PipelineStage`, `AgentExecution`, and `ApprovalDecision`
- `GenerationJob` and `DramaEvaluation`

Important relationships use foreign keys, indexes, unique constraints, and cautious cascade behavior. A `SeriesMemoryFact` keeps `subjectType` and indexed `subjectId` because memory subjects are polymorphic; the repository validates the subject domain, while the series relationship remains relationally constrained.

## Orchestration Persistence

`OrchestrationService` receives a `PersistenceRepository`. Each run persists:

1. The pipeline record and initiating user.
2. Every agent execution and its concise explanation.
3. Stage outputs and deterministic audit metadata.
4. The approval request.
5. Approval or rejection decisions.
6. The final generation job reference only after approval.

Generation remains blocked unless the pipeline is `APPROVED`. Rejection and revision requests are persisted state transitions, not client-only flags.

## Authentication Boundary

`lib/auth` defines provider-neutral contracts:

- `AuthenticatedUser`
- `Session`
- `AuthContext`
- `AuthAdapter`
- `requireUser()`
- `optionalUser()`

The current `MockAuthAdapter` uses a deterministic development user and does not contain credentials. A future identity provider can implement `AuthAdapter` without changing route or domain contracts.

## Authorization Model

Production membership roles are:

- **OWNER**: read, edit, approve, reject, and manage production access.
- **EDITOR**: read and edit production content; cannot approve or reject consequential generation actions.
- **VIEWER**: read-only access.

Relevant API routes call `requireSeriesAccess` server-side. IDs alone do not grant access, and role decisions never rely on client-provided role values. Approval and rejection require `OWNER` access.

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

For the deterministic demo, leave `DATABASE_URL` unset. Tests then use isolated in-memory repositories and do not require PostgreSQL.

For PostgreSQL-backed development, configure a real local `DATABASE_URL` in `.env.local`, then run the Prisma workflow appropriate to the installed toolchain:

```bash
npx prisma generate
npx prisma validate
npx prisma migrate dev --name milestone-3-persistence
```

Never commit `.env.local` or database credentials. The repository contains only placeholder values in `.env.example`.

## Future Production Identity Integration

A production adapter should:

1. Verify the provider session server-side.
2. Map provider subject IDs to the internal `User.id`.
3. Upsert verified profile metadata only.
4. Use the Prisma membership repository for every access check.
5. Preserve `OWNER` approval authorization in the server boundary.

No Gemini, Vertex AI, video, voice, payment, or cloud APIs are required by this milestone.
