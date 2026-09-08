# Milestone 9: Real AI and media providers

Milestone 9 keeps the provider-neutral contracts from Milestones 1–8 and adds executable server-side adapters. Provider selection is explicit, configuration is validated before a job is prepared, and no provider is called until an owner approves the prepared job.

## Provider registry

`ProviderRegistry` exposes stable IDs (`mock`, `gemini-image`, and `vertex-video`), capability discovery, configuration validation, and cached provider instances. `MockMediaProvider` is the only deterministic local implementation. The Gemini and Vertex adapters are real transport implementations, but tests inject fake transports and therefore never make network calls.

The registry validates required fields and supported models. Vertex requires a Google Cloud project, location, and `gs://` output URI. Production rejects every mock selection. Local and test runs must opt into mock mode explicitly with `MEDIA_PROVIDER=mock`, or set both `IMAGE_PROVIDER` and `VIDEO_PROVIDER` to `mock`.

## Gemini AI structured output

`GeminiService` uses Zod schemas for every operation. `DefaultGeminiTransport` sends `responseMimeType: application/json` and a JSON schema to Gemini, validates the response envelope, parses the JSON, and lets the service run the final Zod validation. `FakeGeminiTransport` is deterministic and is used by tests.

## Image and video adapters

`GeminiImageProvider` supports text-to-image only, with explicit model/aspect/resolution validation. It uses the Gemini `generateContent` image response and normalizes inline bytes into a provider-neutral output with MIME type, checksum, size, and metadata. Masking, inpainting, outpainting, image-to-video, and cancellation are explicitly unsupported.

`VertexAIVideoProvider` supports text-to-video only. `ProductionVertexVideoTransport` submits a Vertex `predictLongRunning` operation, polls `fetchPredictOperation`, and normalizes GCS or inline video output. Veo duration/model rules are validated before submission. The current Vertex RPC does not expose cancellation through this adapter, so cancellation returns a typed unsupported error rather than pretending it succeeded.

## Configuration

Copy `.env.example` to `.env.local`; never commit provider credentials.

```env
MEDIA_PROVIDER=mock
IMAGE_PROVIDER=mock
VIDEO_PROVIDER=mock
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_VIDEO_MODEL=veo-3.1-generate-001
VERTEX_OUTPUT_STORAGE_URI=gs://your-bucket/sceneforge/
```

Credentials are server-only. API routes and client components receive provider status and safe metadata, never API keys, ADC tokens, raw provider payloads, or private reasoning.

## Lifecycle and governance

`GenerationService` snapshots prompts, generation parameters, provider, model, and estimated cost while preparing an `awaiting_approval` job. `start` resolves the cached provider and submits only after owner approval. `refresh` maps provider lifecycle states, records normalized errors and safe audit events, and creates one immutable `GeneratedAsset` when output succeeds. Prisma enforces one asset per generation job and the in-memory adapter is idempotent as well. Retry creates a new approval job; cancellation is only offered when the provider advertises it.

## Error and audit policy

Provider errors are normalized to stable categories (`configuration`, `auth`, `rate_limited`, `quota`, `invalid_request`, `unsupported`, `provider_unavailable`, `timeout`, `content_policy`, `cancelled`, and `unknown`). Messages redact credentials and are truncated. Structured provider logs contain provider/model/job IDs, lifecycle, duration, status, and error category only; they never include prompts, tokens, headers, or raw responses.

## Validation

Run the complete suite without provider credentials:

```bash
npm run lint
npm test
npm run build
npx prisma generate
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/sceneforge'; npx prisma validate
git diff --check
```

No migration, database push, deployment, or real-provider call is part of this milestone.
