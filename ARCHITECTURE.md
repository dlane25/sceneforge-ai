# SceneForge AI Architecture

## Overview

SceneForge AI is an AI-native production studio for creating serialized vertical microdramas in 9:16 format. The application is built with Next.js, React, TypeScript, and Tailwind CSS, with a PostgreSQL-ready architecture using Prisma.

## Technology Stack

- **Frontend Framework**: Next.js 14+ with App Router
- **UI Library**: React
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Database**: Prisma (PostgreSQL-ready)
- **Testing**: Vitest
- **Icons**: Lucide React
- **Linting**: ESLint

## Project Structure

```
app/                          # Next.js App Router pages
components/
  layout/                      # Layout components
  studio/                      # Studio-specific components
  series/                      # Series-related components
  characters/                  # Character components
  episodes/                    # Episode components
  storyboard/                  # Storyboard components
  ui/                          # Basic UI components

lib/
  agents/                      # AI agents system
    types.ts                   # Shared agent contracts and production outputs
    base.ts                    # Deterministic execution helper
    showrunner/                # Showrunner agent
    writer/                    # Writer agent
    director/                  # Director agent
    continuity/                # Continuity agent
    editor/                    # Editor agent
    growth/                    # Growth agent

  orchestration/               # Typed multi-agent pipeline and approval gate
  
  ai/
    providers/                 # AI provider abstractions
    prompts/                   # Prompt templates
    schemas/                   # AI response schemas
  
  memory/                      # Series memory system
    characters/                # Character memory/DNA
    world/                     # World memory/DNA
    story/                     # Story memory/DNA
    continuity-checker.ts      # Continuity violation detection
  
  video/
    providers/                 # Video provider abstractions
    mock-provider.ts           # Mock video provider
  
  voice/                       # Voice generation (future)
  db/
    client.ts                    # Server-only Prisma client
    generation-job-repository.ts # Job management
  repositories/                  # Persistence contracts and adapters
    contracts.ts                 # Domain-facing repository interfaces
    in-memory.ts                 # Deterministic test/local adapter
    prisma.ts                    # PostgreSQL adapter
    runtime.ts                   # DATABASE_URL-based selection
  auth/                          # Provider-neutral auth/session boundary
  series-memory/                 # Persistent Series Memory facade
  
  validation/                  # Zod schemas
  mock/                        # Mock data for development

types/                         # TypeScript type definitions
tests/                         # Test files
docs/                          # Documentation
prisma/                        # Prisma schema and migrations
```

## Core Concepts

### 1. Series Memory

Series Memory tracks all creative and continuity data for a production:

#### Character DNA
- Physical appearance (face, hair, wardrobe)
- Voice characteristics
- Personality traits
- Relationships with other characters
- Injuries and status changes
- Possessions

#### World DNA
- Locations and room details
- Vehicles
- Props and set decoration
- Lighting schemes
- Visual style guides

#### Story DNA
- Secrets and plot points
- Character relationships and dynamics
- Injuries, marriages, deaths
- Jobs and money/status changes
- Timeline of events
- Unresolved plot threads

### 2. Continuity Facts

Continuity facts are time-scoped assertions about the state of the world:

```typescript
interface ContinuityFact {
  id: string;
  seriesId: string;
  subjectType: 'character' | 'location' | 'prop' | 'story' | 'relationship' | 'status';
  subjectId: string;
  key: string;           // e.g., "marcus_wearing_rolex"
  value: string;         // e.g., "true"
  validFromEpisode: number;
  validFromScene?: number;
  validFromShot?: number;
  validToEpisode?: number;
  validToScene?: number;
  validToShot?: number;
  source: string;
  confidence: number;    // 0-1
  override?: boolean;
}
```

Time-scoping allows facts to change at specific points in the story without creating massive JSON blobs.

### 3. Continuity Checker

A deterministic checker that:
- Validates shots against active continuity facts
- Detects violations when expected values don't match
- Rates severity based on confidence levels
- Suggests fixes for violations

No AI calls are needed - this is entirely rule-based logic.

### 4. Drama Score

Deterministic scoring system evaluating:
- **Hook Strength** (0-100): How compelling is the opening?
- **Conflict** (0-100): How much tension and opposition?
- **Emotional Intensity** (0-100): How emotionally impactful?
- **Cliffhanger** (0-100): How compelling is the ending?
- **Character Continuity** (0-100): How consistent with character DNA?
- **Overall** (0-100): Weighted combination

Scored based on episode text and structure, not real viewer behavior. Think of it as an internal quality signal, not a prediction of actual retention.

### 5. Video Provider Abstraction

Provider-neutral interface supporting:
- `generateShot()`: Create a new video shot
- `extendShot()`: Extend an existing shot
- `imageToVideo()`: Convert image to video
- `getStatus()`: Check job status
- `estimateCost()`: Estimate generation cost

Current implementation:
- **MockVideoProvider**: Deterministic mock for development
- Ready to swap in Veo, Kling, Seedance, Runway, etc. (no cost)

### 6. Generation Jobs

Track all video generation requests with:
- Status: queued, running, succeeded, failed, cancelled
- Provider and model info
- Prompt version and input hash
- Cost estimation and actual cost
- Retry logic
- Output asset IDs
- Error messages and timestamps

## Determinism

The application prioritizes deterministic behavior:
- Mock data is consistent across runs
- Mock video generation uses deterministic hashing
- Continuity checking is rule-based (no randomness)
- Drama scoring is formula-based (no ML or randomness)

This makes development, testing, and debugging predictable.

## No Hard-Coded Secrets

All configuration uses environment variables:
- `.env.example` documents required variables
- `.env.local` (gitignored) contains local overrides
- No secrets in code or mock data

## Milestone 1 Scope

This milestone establishes the foundation:
- ✓ Type system and domain models
- ✓ Series Memory framework
- ✓ Continuity checking
- ✓ Drama scoring
- ✓ Video provider abstraction
- ✓ Generation job tracking
- ✓ Demo UI and dashboard
- ✓ Mock data (Empire of Lies)
- Future: AI agents, real video APIs, advanced features

## Future Integrations

- AI provider APIs (Claude, GPT, etc.)
- Video generation APIs (Veo, Kling, Seedance, Runway)
- Voice synthesis APIs
- Database schema and migrations
- Authentication and user management
- Production deployment infrastructure

## Milestone 3 Persistence and Auth

Production state is now repository-backed. `OrchestrationService` accepts a `PersistenceRepository`, so pipeline runs, agent executions, approval decisions, and memory facts are not coupled to module-level maps. The runtime chooses Prisma when `DATABASE_URL` is available and uses the in-memory adapter for deterministic tests and local demos.

Users own productions through `ProductionMembership` records with `OWNER`, `EDITOR`, and `VIEWER` roles. API routes enforce access server-side: editors may orchestrate, viewers may read, and only owners may approve or reject generation. The mock auth adapter supplies a development identity without credentials; a future identity provider only needs to implement `AuthAdapter`.

See [docs/PERSISTENCE_AND_AUTH.md](docs/PERSISTENCE_AND_AUTH.md) for the database, repository, authorization, and local setup details.

## Milestone 2 AI Orchestration

The production pipeline is explicit and auditable:

`Series Concept -> Showrunner -> Writer -> Director -> Continuity -> Drama Scoring -> Human Approval -> Mock Generation`

Each agent implements `Agent<TInput, TOutput>`. `AgentExecution` records the agent identity, series and episode, input/output, status, confidence, concise explanation, duration, metadata, and structured errors. Explanations are audit summaries only; private chain-of-thought is never stored.

`OrchestrationService` owns the pipeline state machine: `DRAFT`, `ANALYZING`, `CONTINUITY_REVIEW`, `READY_FOR_APPROVAL`, `APPROVED`, `REJECTED`, `GENERATION_QUEUED`, and `FAILED`. It will not create a GenerationJob until an `ApprovalDecision` is approved.

The current agents are deterministic implementations. A future Gemini or Vertex AI adapter can implement the same `Agent` interface and return the same domain output schemas. Model selection, credentials, retries, and transport belong in the adapter, not in the Writer, Director, Continuity, or orchestration contracts.
