 # SceneForge AI

 SceneForge AI is an AI-native production studio for creating serialized vertical microdramas in 9:16 format. It combines series bibles, character DNA, time-scoped Series Memory, continuity checking, deterministic drama scoring, and provider-neutral generation jobs.

 ## Current Milestone

 Milestone 11 adds deterministic episode assembly from approved video, dialogue audio, and captions, immutable assembly versions, typed validation and owner review, plus approval-gated MP4 export through a deterministic mock engine or server-only local FFmpeg adapter. The fictional **Empire of Lies** demo still runs deterministically with explicit mock mode, while server-only Gemini image, Vertex Veo video, ElevenLabs voice, and local FFmpeg adapters are executable behind validated configuration.

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

 Milestone 9 adds the validated provider registry, structured Gemini operations, and executable image/video transports. See [docs/REAL_AI_MEDIA_PROVIDERS.md](docs/REAL_AI_MEDIA_PROVIDERS.md).

 Milestone 10 adds voice, audio, and captions without bypassing generation or review governance. See [docs/VOICE_AUDIO_CAPTIONS.md](docs/VOICE_AUDIO_CAPTIONS.md).

 Milestone 11 adds episode assembly, timeline validation, version review, and export packaging. See [docs/EPISODE_ASSEMBLY_EXPORT.md](docs/EPISODE_ASSEMBLY_EXPORT.md).

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

 Read the detailed design in [ARCHITECTURE.md](ARCHITECTURE.md), [PRODUCT.md](PRODUCT.md), [docs/SERIES_MEMORY.md](docs/SERIES_MEMORY.md), [docs/PROVIDERS.md](docs/PROVIDERS.md), [docs/REAL_AI_MEDIA_PROVIDERS.md](docs/REAL_AI_MEDIA_PROVIDERS.md), [docs/VOICE_AUDIO_CAPTIONS.md](docs/VOICE_AUDIO_CAPTIONS.md), and [docs/EPISODE_ASSEMBLY_EXPORT.md](docs/EPISODE_ASSEMBLY_EXPORT.md).

 ## Provider setup

 Copy `.env.example` to `.env.local` for local work. Keep image, video, audio, and export providers explicitly set to `mock` for deterministic operation. Production rejects mock mode and requires every selected provider/engine's server-side configuration. See [docs/REAL_AI_MEDIA_PROVIDERS.md](docs/REAL_AI_MEDIA_PROVIDERS.md), [docs/VOICE_AUDIO_CAPTIONS.md](docs/VOICE_AUDIO_CAPTIONS.md), and [docs/EPISODE_ASSEMBLY_EXPORT.md](docs/EPISODE_ASSEMBLY_EXPORT.md).

 ## Future Integrations

 Future milestones can add cloud rendering and distribution without changing the `Agent<TInput, TOutput>`, assembly, repository, export-engine, or approval boundaries.
