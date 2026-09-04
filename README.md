 # SceneForge AI

 SceneForge AI is an AI-native production studio for creating serialized vertical microdramas in 9:16 format. It combines series bibles, character DNA, time-scoped Series Memory, continuity checking, deterministic drama scoring, and provider-neutral generation jobs.

 ## Current Milestone

 Milestone 1 establishes the foundation with a deterministic fictional demo, **Empire of Lies**:

 - 60 planned episodes, 60-90 seconds each, vertical 9:16
 - 4 characters, 3 locations, and 5 outlined episodes
 - Series Memory for character, world, and story facts
 - Rule-based continuity checker with an intentional demo violation
 - Mock video provider and generation-job repository
 - Dashboard, series bible, characters, episodes, memory, continuity, and studio views

 This milestone does not call paid AI, video, or voice APIs.

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

 The Next.js App Router provides the UI. Strict TypeScript domain types live in `types/`. Domain services live in `lib/`, including Series Memory, the continuity checker, drama scoring, the video-provider interface, and deterministic mocks. Prisma is configured for PostgreSQL-ready persistence, while the current demo uses in-memory fixtures.

 Read the detailed design in [ARCHITECTURE.md](ARCHITECTURE.md), [PRODUCT.md](PRODUCT.md), [docs/SERIES_MEMORY.md](docs/SERIES_MEMORY.md), and [docs/PROVIDERS.md](docs/PROVIDERS.md).

 ## Future Integrations

 Future milestones can add authentication, persistent series data, AI writing agents, voice synthesis, and real video providers without coupling the application to a single model.
