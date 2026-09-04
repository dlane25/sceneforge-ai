<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SceneForge AI Milestone 2

Agent work must preserve the provider-neutral architecture. Implement model-specific behavior behind `lib/agents` interfaces, keep agent outputs typed, and store only concise audit explanations rather than private chain-of-thought. Generation must remain behind the human approval gate in `lib/orchestration`.

## SceneForge AI Milestone 3

Persistence must go through `lib/repositories` contracts. Use the Prisma adapter for PostgreSQL and the in-memory adapter for deterministic tests/local operation. API routes must require server-side authentication and production membership checks; never trust client-supplied roles or IDs as authorization. Keep Prisma and credentials server-side.
