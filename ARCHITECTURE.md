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
  
  media/                       # Provider-neutral image, video, voice, and review services
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
- **MockMediaProvider**: Deterministic image/video provider for local and test mode
- **GeminiImageProvider**: server-only Gemini image transport with fake-transport tests
- **VertexAIVideoProvider**: server-only Vertex Veo long-running transport with fake-transport tests
- Capability declarations explicitly mark unsupported extension, masking, image-to-video, and cancellation operations.

### 6. Generation Jobs

Track all video generation requests with:
- Status: queued, running, succeeded, failed, cancelled
- Provider and model info
- Prompt version and input hash
- Cost estimation and actual cost
- Retry logic
- Output asset IDs
- Error messages and timestamps

### 7. Voice, Audio, and Captions

Character voice profiles remain part of production data and Series Memory identity. `AudioGenerationService` resolves the configured speech provider through `ProviderRegistry`, snapshots dialogue, voice controls, model, and cost into the existing `GenerationJob`, and requires owner approval before provider submission. Completed speech creates a generic `GeneratedAsset` with audio metadata and enters the existing human review/version workflow.

`ElevenLabsVoiceProvider` implements synchronous speech generation through an injectable, server-only transport. `MockMediaProvider` implements the same overlapping contract with deterministic polling and audio metadata. Provider errors use the Milestone 9 taxonomy, and provider audit events exclude dialogue, credentials, headers, binary audio, and raw responses.

`CaptionService` derives deterministic SRT or WebVTT segments from persisted scene/shot order and duration. Caption tracks and segments persist through repository contracts with review, version, and preferred-state metadata. Captions do not use AI to invent timing.

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

## Milestone 4 Real Auth and CRUD

Auth.js is adapted through `AuthAdapter` and is configured only when `AUTH_MODE=authjs` plus provider credentials are present. The deterministic mock adapter remains available for local and test runs; production rejects mock mode by default. First-login provisioning maps provider subject and verified email to a stable local `User` record.

`ProductionService` owns authenticated production CRUD and membership mutations. It uses repository contracts, applies `OWNER`/`EDITOR`/`VIEWER` rules, and prevents removal or demotion of the last owner. API routes only parse requests, resolve the current user, call the service, and map sanitized errors.

The UI now includes session-aware navigation, a membership-filtered production library, persisted production creation, production settings, archiving, and owner membership management. No database credentials or provider secrets enter client components.

## Milestone 5 Production Data

Production data CRUD is exposed through `ProductionDataRepository` and `ProductionService`. Characters, locations, episodes, scenes, and story facts are production-scoped and authorization-checked. Episode and scene numbering is unique within its parent, and cross-production references are rejected before persistence. The deterministic Series Memory checker can consume persisted time-scoped continuity facts through the same repository boundary.

See [docs/PRODUCTION_DATA.md](docs/PRODUCTION_DATA.md) for the detailed model and API list.

## Milestone 6 Storyboard Production

Shots and storyboard placeholders extend the persisted `Series -> Episode -> Scene` hierarchy. `ProductionDataRepository` owns shot CRUD, ordering, storyboard metadata, and full-parent validation. Orchestration loads persisted series, story facts, continuity facts, and shots into typed `AgentContext` through repository contracts; agents remain Prisma-independent. Readiness is a deterministic structured evaluation and does not bypass the human approval gate.

## Milestone 7 Media Provider Pipeline

`GenerationService` coordinates provider-neutral shot generation through repository contracts. It snapshots prompts and estimates cost before creating an `awaiting_approval` job, then permits owner-governed execution only after approval. `GeneratedAsset` records provider-neutral output metadata. The mock provider never calls the network and supports deterministic status, cancel, retry, and mock asset behavior.

## Milestone 8 Media Review

`MediaReviewService` persists human review decisions and asset selection through repository contracts. Assets remain historical; only approved assets may become preferred, replacing and superseding a prior preferred version without deletion. Review records retain actor, notes, rejection reason, and continuity assessment. Agents remain read-only consumers of this provider-neutral state.

## Milestone 9 Real AI and media providers

`ProviderRegistry` resolves stable `mock`, `gemini-image`, and `vertex-video` IDs with capability discovery and fail-fast configuration validation. `GeminiService` uses server-only structured output with Zod validation; its production transport is injectable and tests use deterministic fakes. Gemini image and Vertex Veo adapters normalize provider lifecycle, output, cost, and errors behind `MediaProvider`. `GenerationService` snapshots provider/model/request data before approval and only submits after owner approval; refresh is idempotent and repository-backed. Credentials and ADC tokens remain server-only, and safe provider audit events never include prompts, tokens, or raw responses.

## Milestone 10 Voice, Audio, and Captions

The provider contract now declares speech, voice-cloning, optional sound-effects, and caption capabilities explicitly. Stable `elevenlabs-voice` support is executable only on the server, while tests use fake HTTP or deterministic mock transports. Voice rights metadata blocks cloned, licensed, or uploaded-reference sources until ownership and consent are approved. Audio and captions use the same production authorization, repositories, review history, preferred-version semantics, sanitized APIs, and deterministic local behavior established in Milestones 1–9.

See [docs/VOICE_AUDIO_CAPTIONS.md](docs/VOICE_AUDIO_CAPTIONS.md).

## Milestone 2 AI Orchestration

The production pipeline is explicit and auditable:

`Series Concept -> Showrunner -> Writer -> Director -> Continuity -> Drama Scoring -> Human Approval -> Mock Generation`

Each agent implements `Agent<TInput, TOutput>`. `AgentExecution` records the agent identity, series and episode, input/output, status, confidence, concise explanation, duration, metadata, and structured errors. Explanations are audit summaries only; private chain-of-thought is never stored.

`OrchestrationService` owns the pipeline state machine: `DRAFT`, `ANALYZING`, `CONTINUITY_REVIEW`, `READY_FOR_APPROVAL`, `APPROVED`, `REJECTED`, `GENERATION_QUEUED`, and `FAILED`. It will not create a GenerationJob until an `ApprovalDecision` is approved.

The current agents are deterministic implementations. A future Gemini or Vertex AI adapter can implement the same `Agent` interface and return the same domain output schemas. Model selection, credentials, retries, and transport belong in the adapter, not in the Writer, Director, Continuity, or orchestration contracts.
