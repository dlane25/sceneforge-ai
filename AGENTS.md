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
