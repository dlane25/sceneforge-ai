<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SceneForge AI Milestone 2

Agent work must preserve the provider-neutral architecture. Implement model-specific behavior behind `lib/agents` interfaces, keep agent outputs typed, and store only concise audit explanations rather than private chain-of-thought. Generation must remain behind the human approval gate in `lib/orchestration`.

## SceneForge AI Milestone 3

Persistence must go through `lib/repositories` contracts. Use the Prisma adapter for PostgreSQL and the in-memory adapter for deterministic tests/local operation. API routes must require server-side authentication and production membership checks; never trust client-supplied roles or IDs as authorization. Keep Prisma and credentials server-side.

## SceneForge AI Milestone 4

Use Auth.js only through `lib/auth/authjs.ts` and preserve the `AuthAdapter` boundary. Keep `AUTH_MODE=mock` explicit for local/tests and reject it in production unless intentionally configured. Provision users by provider subject and verified email. Keep production CRUD authorization in `ProductionService`; API handlers should not invent role checks. Never add provider credentials or `.env.local` files to the repository.

## SceneForge AI Milestone 5

Production data CRUD must go through `ProductionDataRepository` and `ProductionService`. Keep all entity operations production-scoped and authorize through memberships. Validate parent references before writes, preserve deterministic in-memory tests, and keep Prisma server-side. Do not replace the deterministic continuity checker with an LLM.

## SceneForge AI Milestone 6

Shots and storyboards must remain provider-neutral and production-scoped. Use existing repository/service contracts, preserve full series/episode/scene hierarchy checks, and keep readiness deterministic. Persisted production context should reach agents through `AgentContext`, never through direct Prisma imports. Generation remains behind existing approval/governance controls.

## SceneForge AI Milestone 7

Media jobs and assets must use the existing repository and production-service boundaries. Snapshot prompts and cost before approval; never invoke a provider before explicit owner approval. Keep mocks deterministic, errors auditable, and future provider behavior behind `VideoProvider` contracts.

## SceneForge AI Milestone 8

Asset review must preserve history and require human decisions. Only approved assets can be preferred; never overwrite or silently discard prior versions. Review services must use repositories and production authorization, surface Series Memory blockers, and keep agents/provider adapters unable to bypass review governance.

## SceneForge AI Milestone 9

Real AI and media provider integration must preserve provider-neutral architecture. Implement provider registry with capability discovery, configuration validation, and explicit mock mode. Gemini AI operations must use structured output with Zod validation and deterministic fake transport for tests. Real provider adapters may execute only through server-side transports, while tests inject fakes and make no network calls. Generation remains behind the human approval gate. Provider operations must be auditable and error-normalized. All Milestones 1-8 behavior is fully preserved.

## SceneForge AI Milestone 10

Voice, audio, and captions must extend the existing provider, generation, repository, and review architecture. Keep character voice profiles provider-neutral and require explicit approved rights and consent for cloned, licensed, or uploaded-reference voices. Snapshot dialogue, voice, model, parameters, and cost before owner approval; never invoke a speech provider before that approval. Audio assets must use existing version/review/preferred governance, scoped by asset type. Caption timing must be deterministic when provider transcript timing is unavailable. Keep all credentials and production transports server-only, inject fakes in tests, and never log raw dialogue, audio, credentials, headers, or provider responses.

## SceneForge AI Milestone 11

Episode assembly and export must use repository-owned, approved production assets and deterministic canonical ordering. Never select pending/rejected media or bypass assembly/export owner approval. Keep assembly versions immutable, media-type selection scoped, validation codes typed, and render engines behind the server-only `ExportEngine` contract. FFmpeg must receive an argument array through a non-shell process, accept only validated managed/HTTPS inputs, and never expose filesystem paths, raw stderr, captions, dialogue, or source URIs in client errors or logs. Tests use deterministic mock/fake execution and make no network or real render calls.

## SceneForge AI Milestone 12

Production launch readiness must remain deterministic, typed, multi-check, and remediation-oriented. Never treat configuration presence as provider health, call paid providers from health/startup checks, publish content, or auto-approve/retry consequential work. Production must use Auth.js and Prisma explicitly and must reject mock providers, mock export, and in-memory persistence. Launch packages snapshot approved artifacts, readiness, rights/consent, and decisions; changed inputs create new versions without mutating approved history. Request IDs, logs, errors, health output, manifests, and storage references must never expose secrets, raw payloads, database URLs, server paths, or provider responses.
