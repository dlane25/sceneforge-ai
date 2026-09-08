 # SceneForge AI

 SceneForge AI is an AI-native production studio for creating serialized vertical microdramas in 9:16 format. It combines series bibles, character DNA, time-scoped Series Memory, continuity checking, deterministic drama scoring, and provider-neutral generation jobs.

 ## Current Milestone

 Milestone 9 adds real-provider contracts on top of the production-scoped, approval-governed pipeline. The fictional **Empire of Lies** demo still runs deterministically with explicit mock mode, while server-only Gemini structured output/image and Vertex Veo video adapters are executable behind validated configuration.

 - 60 planned episodes, 60-90 seconds each, vertical 9:16
 - 4 characters, 3 locations, and 5 outlined episodes
 - Series Memory for character, world, and story facts
 - Rule-based continuity checker with an intentional demo violation
 - Mock video provider and generation-job repository
 - Dashboard, series bible, characters, episodes, memory, continuity, and studio views

 Tests never call paid AI, video, voice, or cloud APIs: they use deterministic fakes or injected HTTP transports. Production integrations require explicit provider selection and server-side credentials.

 Persistence is PostgreSQL-ready through Prisma. Without `DATABASE_URL`, the app and tests use deterministic in-memory repositories; with `DATABASE_URL`, the runtime selects the Prisma repository. Auth.js provides pluggable production sessions, while `AUTH_MODE=mock` is the explicit local/test fallback. See [docs/REAL_AUTH_AND_CRUD.md](docs/REAL_AUTH_AND_CRUD.md) and [docs/PERSISTENCE_AND_AUTH.md](docs/PERSISTENCE_AND_AUTH.md).

 The `/series` library lists only productions available to the current user. Creating a production persists it and makes the creator its `OWNER`; the production settings view supports metadata edits, archive, and owner-managed membership. The production data workspace manages characters, locations, episodes, scenes, and Series Memory facts.

 See [docs/PRODUCTION_DATA.md](docs/PRODUCTION_DATA.md) for the entity model, repository contracts, API surface, and migration workflow.

 Milestone 6 adds provider-neutral shot planning and storyboard placeholders. The production workspace now supports scene shots, ordering, readiness checks, and continuity-aware production context without calling external generation services. See [docs/STORYBOARD_PRODUCTION.md](docs/STORYBOARD_PRODUCTION.md).

 Milestone 7 adds the approval-governed media lifecycle: prepare, estimate, approve, submit, poll, complete, and review generated assets. See [docs/MEDIA_PROVIDER_PIPELINE.md](docs/MEDIA_PROVIDER_PIPELINE.md).

 Milestone 8 adds generated asset review, immutable version history, approval/rejection records, and preferred asset selection. See [docs/MEDIA_REVIEW_WORKFLOW.md](docs/MEDIA_REVIEW_WORKFLOW.md).

 ## Run Locally

 ```bash
 npm install
 cp .env.example .env.local
 npm run dev
 ```

 Open [http://localhost:3000](http://localhost:3000).

 Validation commands:

 ```bash
 npm run lint
 npm test
 npm run build
 ```

 ## Architecture

 The Next.js App Router provides the UI. Strict TypeScript domain types live in `types/`. Domain services live in `lib/`, including Series Memory, the continuity checker, drama scoring, the provider-neutral video layer, and deterministic agents. `lib/orchestration` coordinates typed outputs and enforces the approval gate before mock generation. Prisma is PostgreSQL-ready; the deterministic demo uses in-memory fixtures.

 The pipeline is exposed at `/api/series/[id]/orchestrate`, `/api/pipelines/[id]`, `/api/pipelines/[id]/approve`, `/api/pipelines/[id]/reject`, and `/api/agent-executions`. Episode-level action routes are available under `/api/episodes/[id]`.

 Read the detailed design in [ARCHITECTURE.md](ARCHITECTURE.md), [PRODUCT.md](PRODUCT.md), [docs/SERIES_MEMORY.md](docs/SERIES_MEMORY.md), and [docs/PROVIDERS.md](docs/PROVIDERS.md), and [docs/REAL_AI_MEDIA_PROVIDERS.md](docs/REAL_AI_MEDIA_PROVIDERS.md).

 ## Provider setup

 Copy `.env.example` to `.env.local` for local work. Keep `MEDIA_PROVIDER=mock` (or explicitly set both `IMAGE_PROVIDER` and `VIDEO_PROVIDER` to `mock`) for deterministic operation. Production rejects mock mode and requires the selected provider's key/project/location/storage configuration. See [docs/REAL_AI_MEDIA_PROVIDERS.md](docs/REAL_AI_MEDIA_PROVIDERS.md).

 ## Future Integrations

 Future milestones can add voice synthesis and episode assembly without changing the `Agent<TInput, TOutput>` contracts, repository boundaries, or approval state machine.
