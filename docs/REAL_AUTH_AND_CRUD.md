# Real Authentication and Production CRUD

## Implemented

Milestone 4 adds a functional authentication and production-management boundary while keeping AI and video providers deterministic.

- Auth.js is the production authentication integration.
- GitHub and Google OAuth providers are enabled only when their credentials are configured.
- `AuthAdapter` remains the domain-facing contract.
- The current development/test adapter is deterministic and never contacts an identity provider.
- Authenticated users are provisioned idempotently into the local `User` table.
- Productions, memberships, metadata updates, archiving, and membership changes use repository/service layers.
- Prisma is selected when `DATABASE_URL` is configured; tests use in-memory repositories.

## Auth Architecture

`lib/auth/types.ts` defines `AuthenticatedUser`, `Session`, `AuthContext`, and `AuthAdapter`.

`lib/auth/authjs.ts` adapts Auth.js session data into SceneForge identity data. `auth.ts` configures Auth.js and exposes the App Router handlers. The adapter stores only provider, provider subject, email, and display name. It does not persist provider tokens or secrets.

`lib/auth/mock.ts` provides a deterministic local identity. It is selected by default outside production and is useful for tests. In production, `requireUser()` rejects the mock mode unless `AUTH_MODE=authjs` is explicitly configured.

The standard Auth.js routes are available under `/api/auth/*`. The application also exposes `/api/auth/session` and a server-side sign-out endpoint.

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sceneforge
AUTH_MODE=mock
AUTH_SECRET=replace-with-a-local-secret
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

For OAuth production mode:

```env
AUTH_MODE=authjs
AUTH_SECRET=<strong-random-secret>
AUTH_TRUST_HOST=true
```

Provider credentials belong only in the environment. Never commit `.env.local`.

## User Provisioning

On the first authenticated request, `optionalUser()` resolves the adapter session and calls `upsertUserIdentity()` using `(provider, providerSubject)` plus verified email linking. This is idempotent. If an invited placeholder already owns the email, the first real login links the provider identity to that local user record.

The application uses the local SceneForge user ID for membership and authorization decisions. Client-supplied IDs and roles are never trusted.

## Production CRUD

`ProductionService` is the authoritative service layer:

- `listAccessibleSeries(user)`
- `createSeries(user, input)`
- `getSeries(user, id)`
- `updateSeries(user, id, input)`
- `archiveSeries(user, id)`
- `listMembers(user, seriesId)`
- `addMember(user, seriesId, input)`
- `updateMemberRole(user, seriesId, memberId, role)`
- `removeMember(user, seriesId, memberId)`

Creation makes the authenticated user an `OWNER`. Archive is a reversible status transition rather than a destructive delete.

## Membership Authorization

- `OWNER`: read, edit, archive, add members, change roles, remove members, approve/reject consequential pipeline actions.
- `EDITOR`: read and edit production content; cannot manage membership or archive.
- `VIEWER`: read only.

A production must always retain at least one `OWNER`. Membership checks occur on the server in `ProductionService` and route handlers. Knowing a production ID does not grant access.

## API Routes

- `GET /api/series`
- `POST /api/series`
- `GET /api/series/[id]`
- `PATCH /api/series/[id]`
- `DELETE /api/series/[id]` archives a production
- `GET /api/series/[id]/members`
- `POST /api/series/[id]/members`
- `PATCH /api/series/[id]/members/[memberId]`
- `DELETE /api/series/[id]/members/[memberId]`

All request bodies use Zod schemas. Responses use the existing `{ data }` or `{ error: { code, message } }` shape.

## Prisma Runtime

`lib/repositories/runtime.ts` selects `PrismaPersistenceRepository` when `DATABASE_URL` is set. Without it, `InMemoryPersistenceRepository` seeds only the deterministic Empire of Lies demo and keeps tests database-free.

The Prisma client is server-only. Client components call API routes and never import Prisma or database credentials.

## Migration Workflow

No destructive database command is run by this milestone. Validate and generate the client with:

```bash
npx prisma generate
npx prisma validate
```

For a configured local PostgreSQL database, create and apply a migration manually:

```bash
npx prisma migrate dev --name milestone-4-real-auth-crud
```

Do not run `prisma migrate reset`, database drops, or destructive resets without explicit approval.

## Local Codespaces Setup

The deterministic mode requires no external service:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Leave `AUTH_MODE=mock` and omit `DATABASE_URL` for the offline demo. To exercise real authentication, configure Auth.js provider credentials and `AUTH_MODE=authjs` in an uncommitted `.env.local`.

## Security Notes

- Production rejects mock authentication unless explicitly configured for Auth.js.
- Auth.js owns session and CSRF behavior.
- Provider secrets stay in server environment variables.
- Database errors are sanitized before returning to clients.
- Membership authorization is server-side and service-layer authoritative.
- AI-generated data remains validated at API boundaries.

Real AI, video, voice, payment, deployment, and invitation-email integrations remain out of scope.
