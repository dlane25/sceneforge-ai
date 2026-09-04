 # SceneForge AI

 SceneForge AI is an AI-native production studio for creating serialized vertical microdramas in 9:16 format. It combines series bibles, character DNA, time-scoped Series Memory, continuity checking, deterministic drama scoring, and provider-neutral generation jobs.

 ## Current Milestone

 Milestone 2 adds deterministic AI orchestration on top of the foundation. The fictional **Empire of Lies** demo now runs through Showrunner, Writer, Director, Continuity, Drama Scoring, human approval, and mock generation.

 - 60 planned episodes, 60-90 seconds each, vertical 9:16
 - 4 characters, 3 locations, and 5 outlined episodes
 - Series Memory for character, world, and story facts
 - Rule-based continuity checker with an intentional demo violation
 - Mock video provider and generation-job repository
 - Dashboard, series bible, characters, episodes, memory, continuity, and studio views

 This milestone does not call paid AI, video, voice, or cloud APIs. All agent implementations are deterministic fixtures behind replaceable interfaces.

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

 Read the detailed design in [ARCHITECTURE.md](ARCHITECTURE.md), [PRODUCT.md](PRODUCT.md), [docs/SERIES_MEMORY.md](docs/SERIES_MEMORY.md), and [docs/PROVIDERS.md](docs/PROVIDERS.md).

 ## Future Integrations

 Future milestones can add authentication, persistent series data, Gemini/Vertex AI agents, voice synthesis, and real video providers without changing the `Agent<TInput, TOutput>` contracts or the orchestration state machine.
