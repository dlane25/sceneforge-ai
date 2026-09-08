# Production Launch

Milestone 12 hardens SceneForge's existing end-to-end production path. It adds deterministic launch readiness, unified operations, final delivery manifests and approval-gated launch packages, production configuration checks, health endpoints, request controls, container packaging, and CI gates. It does not publish content to any external platform.

## Production topology

The supported topology is a self-hosted Next.js/Node application with:

- Auth.js JWT sessions and at least one configured OAuth provider;
- PostgreSQL through the Prisma repository (production never falls back to memory);
- server-only Gemini image, Vertex video, and ElevenLabs voice transports;
- repository-owned media references and reviewed assets;
- a server-local FFmpeg engine using managed input/output roots;
- a reverse proxy terminating HTTPS and forwarding only trusted host values.

Provider calls remain behind generation approval. FFmpeg remains behind assembly approval and export approval. Final launch readiness adds another explicit owner decision; it does not replace any earlier gate.

## Environment contract and startup

`.env.example` is the canonical inventory. Local development uses explicit `mock` values. A production runtime requires `NODE_ENV=production`, PostgreSQL, `AUTH_MODE=authjs`, a canonical HTTPS `APP_BASE_URL` and `AUTH_URL`, an Auth.js secret and OAuth provider pair, real image/video/audio provider selections with their server credentials/configuration, and `EXPORT_ENGINE=ffmpeg-local` with managed roots.

Private values never use `NEXT_PUBLIC_*`. Google Application Default Credentials are supplied by the runtime rather than committed. Optional endpoint overrides must remain controlled HTTPS origins.

`npm run check:startup` is fail-fast and makes no paid provider call. It validates required key names, environment/provider consistency, canonical URLs, managed directories, and an FFmpeg `-version` probe invoked without a shell. It prints only missing/invalid key names, never values. `npm start` runs this check before starting Next.js. Production repository initialization also rejects missing `DATABASE_URL`; a build phase may still compile without production credentials.

## Readiness architecture

`ProductionReadinessService` returns a report, never only a boolean. Every check has a stable ID, category, status, severity, explanation, remediation, affected resource, timestamp, and blocking state.

Application checks cover environment mode, database, Auth.js, canonical URLs, real provider selections and required configuration, export engine, FFmpeg configuration, and managed roots. They inspect configuration only and do not contact paid providers.

Series checks cover metadata, owner retention, cast, world locations, episodes, character rights/consent, and every episode report.

Episode checks cover scenes, ordered shots, storyboard placeholders, approved preferred video and dialogue audio, safe sources, captions, deterministic continuity, unresolved job failures and approvals, preferred approved assembly, rejected selections, completed export, output metadata, safe delivery URI, and export approval.

The production page embeds the launch dashboard with checklist progress, blockers, warnings, configuration health, operations health, approval/rights issues, and completed exports. Episode production embeds launch package controls beside assembly/export.

## Rights and content gates

Licensed, uploaded-reference, and cloned voices block launch unless rights and consent are both confirmed, approval is `approved`, and confirmation has a timestamp. Reports identify the character and source type but never expose reference audio or private source metadata.

Launch also blocks missing/rejected/unapproved preferred media, unsafe source URIs, invalid or unapproved assemblies, incomplete exports, unsafe output references, unresolved failed jobs, and open approval gates. Checks reuse persisted Milestones 8–11 states; engines and providers cannot override them.

## Unified operations and recovery

`OperationsService` normalizes video/image generation, audio generation, and export jobs into one safe read model. Each record includes kind, hierarchy, state, retry count, retryability, age, classifications, remediation, and an existing governed action route.

Default stale thresholds are:

- awaiting approval: 24 hours (`STALE_APPROVAL_MS`);
- queued: 30 minutes (`STALE_QUEUED_MS`);
- processing: 2 hours (`STALE_PROCESSING_MS`).

Configured values must be integer milliseconds of at least one minute. Detection is read-only: it never approves, retries, cancels, or mutates a consequential job.

Recovery continues to use existing generation/audio/export services. Maximum retries remain three, every retry preserves the old failed/cancelled job, clears provider/output state, and returns to human approval. Completion and refresh remain idempotent, asset creation is deduplicated by generation job, and normalized errors remain the only client-visible failure detail.

Incident basics:

1. inspect `/api/operations` and the correlated request ID;
2. refresh a provider/engine state through its existing route;
3. if retryable, create the approval-gated retry rather than editing evidence;
4. replace/review/prefer new media, rebuild assembly, and create a new package version;
5. never mutate an approved historical launch package.

## Health and observability

- `GET /api/health/live` confirms the Node route runtime can respond.
- `GET /api/health/ready` evaluates sanitized blocking config checks and bounded database connectivity.

Health checks make no Gemini, Vertex, ElevenLabs, or rendering calls. The public response contains stable check IDs/status only, not credentials, database errors, directories, or provider payloads.

API proxying assigns or preserves a safe `x-request-id`. Error responses include that ID, use it in the safe API-failure event, and return it as a header. IDs contain no user data and are not authentication. Existing provider, generation, audio, assembly, and export logging remains structured; Milestone 12 adds launch/config/readiness/API events. Whitelisted events exclude prompts/dialogue, caption contents, media bytes/URLs, cookies, tokens, headers, provider responses, environment values, database URLs, process arguments, and filesystem contents.

## Request and session security

All launch and operations routes authenticate server-side, validate nested IDs/bodies with Zod, and delegate membership/owner decisions to services. Error responses normalize validation, authentication, authorization, state, rate-limit, not-found, and generic failures without raw Prisma/provider/shell errors.

The Next.js 16 `proxy.ts` boundary applies to `/api/*`. It rejects cross-site state-changing requests using `Sec-Fetch-Site` and `Origin`/Host comparison, caps declared request bodies at 1 MiB, and propagates correlation IDs. Cookie-backed Auth.js sessions use secure cookies in production, a JWT strategy, explicit trusted-host configuration, and same-origin-only redirect handling. Route services still reauthorize every operation; proxy checks are defense in depth, not authorization.

Costly orchestration, media generation/submission, audio generation/submission, export preparation/execution, and retry routes use a provider-neutral fixed-window limiter keyed by action, authenticated user, and series. Defaults are deterministic and return HTTP 429 with `Retry-After`. The in-memory adapter is the test/dev reference; a multi-instance production deployment must provide a distributed implementation behind the same contract.

Security headers include CSP, `nosniff`, strict referrer policy, restrictive permissions policy, frame denial, and production HSTS. CSP allows the application's own scripts/styles plus HTTPS/data/blob image and media playback required by reviewed assets; it denies objects, framing, and foreign form actions.

## Delivery manifests and launch packages

Every completed approved episode export can produce a typed manifest containing series/episode, assembly ID/version, export job/version, output identifier, format, dimensions, aspect, codecs, duration, file size, checksum, caption mode/sidecar, completion time, approval state, safe output reference, and manifest version.

An internal `EpisodeLaunchPackage` snapshots the series/episode metadata, manifest, approved asset IDs, captions, rights attestations, approval summary, continuity summary, and the complete readiness report. Preparation fingerprints all required artifacts and decisions. Identical inputs deduplicate; changed exports, captions, selected asset review state, assembly/export approvals, or rights create a new deterministic episode-local version. Prior packages and decisions are never overwritten.

Workflow:

`prepare -> validate current fingerprint/readiness -> request owner approval -> approve/reject -> optionally mark launch-ready package preferred`

Only an owner may prepare or decide. Approval stores actor, note, time, package version, and immutable readiness evidence. No automatic approval exists.

## Storage and FFmpeg

Raw binaries remain outside Prisma; repositories persist safe references and metadata. `StorageInspector` supports local managed export inspection (confined to an absolute root with size/checksum/existence) and declared safe HTTPS references without making a network call. This is intentionally not a cloud object-storage implementation.

The Docker runtime installs FFmpeg explicitly and configures `/app/media` and `/app/exports` for the non-root application user. This increases image size and patch responsibility but makes the existing local render boundary operational. Production operators must mount durable managed volumes or replace the storage inspector/engine with a real, fully implemented backend.

## Deployment and CI

The multi-stage `Dockerfile` installs locked Node dependencies, generates Prisma, builds Next.js standalone output, runs as a non-root user, installs FFmpeg intentionally, excludes secrets, and exposes the liveness healthcheck. `.dockerignore` excludes `.env*`, Git state, caches, logs, and local dependencies. Build and run configuration is injected at runtime; the image contains no provider credentials.

`.github/workflows/ci.yml` uses Node 22 and `npm ci --ignore-scripts`, then runs the repository launch gate with explicit mocks. No production secrets or services are required.

`npm run validate:launch` runs, in order:

1. Prisma generate and validate against a syntactically valid dummy URL;
2. ESLint;
3. standalone TypeScript;
4. deterministic tests;
5. production build with explicit mocks;
6. `git diff --check`.

It never migrates, pushes a schema, deploys, renders, or calls a provider.

## Deterministic launch checklist

Application:

- production config, Auth.js, PostgreSQL, real providers, FFmpeg/export roots valid;
- liveness/readiness green;
- CI launch gate green.

Series:

- metadata, owner, cast, world locations, and episodes complete;
- voice/reference rights and consent complete;
- every episode ready and final exports complete.

Episode:

- storyboard, approved preferred video/audio, safe sources, and captions ready;
- continuity reviewed;
- assembly approved, valid, and preferred;
- export approved, completed, safe, and metadata-complete;
- manifest valid and launch package owner-approved.

Governance:

- no open blocking approvals or unresolved failures;
- no rejected content selected;
- immutable version and decision audit trail intact.

## Limitations

Milestone 12 does not perform deployment, database migration, cloud storage provisioning, DNS/TLS setup, secret rotation, external penetration testing, paid-provider verification, cloud rendering, CDN delivery, billing, analytics, or publication/distribution to TikTok, YouTube, Instagram, or any other platform. In-memory rate limits are not multi-instance coordination. HTTPS asset existence is declared metadata unless a production storage implementation is supplied. Operational ownership of PostgreSQL backups, mounted media durability, FFmpeg security updates, monitoring retention, and OAuth/provider consoles remains with the deployer.
