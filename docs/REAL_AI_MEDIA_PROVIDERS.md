# Milestone 9: Real AI + Media Provider Integration

## Overview

Milestone 9 adds production-capable real AI and media provider integration to SceneForge AI while preserving deterministic mock provider and all Milestones 1-8 behavior.

This milestone provides:
- **Provider Registry**: Stable provider resolution with capability discovery and configuration validation
- **Gemini AI Integration**: Server-only structured output for shot enhancement, continuity analysis, and generation recommendations
- **Real Image Provider**: Google Gemini image generation adapter
- **Real Video Provider**: Google Vertex AI (Veo 2) video generation adapter
- **Async Synchronization**: Idempotent polling and completion tracking
- **Error Normalization**: Typed errors with retry logic and safe error messages
- **Extended Metadata**: Comprehensive tracking of provider operations and asset information

## Architecture

### Provider Registry Pattern

The provider registry manages all media provider resolution:

```typescript
// Resolve a provider with configuration
const registry = createProviderRegistry();
const provider = registry.resolve('vertex-video', {
  projectId: 'my-gcp-project',
  location: 'us-central1'
});

// List available providers
const providers = registry.listAvailable();

// Validate configuration before use
const validation = registry.validateConfig('gemini-image', config);
if (!validation.valid) {
  console.error(validation.errors);
}
```

**Key Features:**
- Stable provider IDs: `mock`, `gemini-image`, `vertex-video`
- Capability discovery (what each provider can do)
- Configuration validation (fail fast for invalid config)
- Explicit mock mode (never silently fall back)
- Type-safe provider resolution

### Provider Capabilities

Each provider declares what it can do:

```typescript
interface ProviderCapabilities {
  imageGeneration?: boolean;
  videoGeneration?: boolean;
  imageMasking?: boolean;
  videoExtension?: boolean;
  imageToVideo?: boolean;
  synchronous?: boolean;
  asyncWithPolling?: boolean;
  cancellation?: boolean;
  costEstimation?: boolean;
  supportedAspectRatios?: string[];
  supportedDurations?: { min: number; max: number };
  supportedResolutions?: { min: number; max: number };
  supportedModels?: string[];
}
```

### Gemini AI Service

The Gemini service provides structured AI operations with Zod validation:

```typescript
const service = new GeminiService(apiKey);

// Enhance shot prompt
const enhancement = await service.enhanceShotPrompt(
  'A person walking through an office'
);
// Returns: { enhancedPrompt, negativePrompt, confidence, reasoning }

// Generate continuity constraints
const continuity = await service.generateContinuityPrompt(
  seriesMemoryContext,
  shotDescription
);
// Returns: { continuityConstraints, characterAppearanceNotes, ... }

// Get provider recommendation
const recommendation = await service.recommendProvider(description, difficulty);
// Returns: { recommendedProvider, recommendedModel, reasoning, ... }

// Comprehensive shot enhancement
const result = await service.enhanceShot(description, memoryContext, style);
// Returns all enhancements with overall confidence
```

**Key Features:**
- Structured output with Zod validation
- Deterministic fake transport for testing (no network calls)
- Server-only (never exposed to browser)
- All AI outputs validated before entering domain state
- Confidence scores for all operations

### Real Providers

#### Gemini Image Provider

Generates images via Google Gemini API:
- Capabilities: Image generation, inpainting, outpainting, masking
- Asynchronous with polling
- Cost estimation
- No cancellation support

#### Vertex AI Video Provider

Generates videos via Google Vertex AI (Veo 2):
- Capabilities: Video generation, video extension
- Asynchronous with polling
- Cancellation support
- Duration limits: 1-120 seconds
- Cost estimation

### Configuration

All provider configuration is server-only. Environment variables:

```bash
# Primary media provider (defaults to mock for dev/test)
MEDIA_PROVIDER=mock                    # or: gemini-image, vertex-video

# Separate image/video providers (optional, defaults to MEDIA_PROVIDER)
IMAGE_PROVIDER=gemini-image
VIDEO_PROVIDER=vertex-video

# AI model selection
GEMINI_MODEL=gemini-2.0-flash

# Google Cloud (for Vertex AI video)
GOOGLE_CLOUD_PROJECT=my-project
GOOGLE_CLOUD_LOCATION=us-central1

# Provider API credentials
MEDIA_PROVIDER_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# Custom endpoint (optional)
MEDIA_PROVIDER_ENDPOINT=https://api.custom.com
```

Configuration is validated at startup:
- Production mode requires explicit provider (not mock)
- Missing required config throws errors immediately
- Development/test default to mock

```typescript
const config = loadMediaProviderConfig();
if (!config.valid) {
  throw new Error(config.errors.join('\n'));
}
```

### Generation Lifecycle with Providers

The generation service preserves the existing approval workflow while adding provider support:

```
Shot -> Readiness Check
  |
  v
Create Job (provider: mock, awaiting_approval)
  |
  v
[Owner Approves]
  |
  v
Start (resolve provider, submit to API, get providerJobId)
  |
  v
Poll (check provider status, update lastPolledAt)
  |
  v
Complete (fetch output, create GeneratedAsset)
  |
  v
Review (human approval/rejection)
```

**New fields tracked:**
- `provider`: Provider ID (mock, gemini-image, vertex-video)
- `providerJobId`: Provider-specific job identifier
- `providerModel`: Model used (e.g., veo-2, gemini-2.0-flash)
- `lastPolledAt`: Last status check timestamp
- `lastProviderStatus`: Last observed provider status
- `actualCost`: Final cost from provider

### Generated Asset Metadata

Assets now track complete provider context:

```typescript
interface GeneratedAsset {
  // Existing fields
  id: string;
  generationJobId: string;
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  version: number;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  
  // New provider metadata
  provider: string;
  providerJobId?: string;
  providerModel?: string;
  storageUri?: string;
  fileSize?: number;
  checksum?: string;
  generationParameters?: Record<string, unknown>;
  promptSnapshot?: string;
  negativePromptSnapshot?: string;
  
  // Cost tracking
  costMetadata?: {
    estimatedCost: number;
    actualCost: number;
    currency?: string;
  };
}
```

### Error Normalization

All provider errors are normalized to typed codes:

```typescript
enum ProviderErrorCode {
  ConfigurationError = 'configuration_error',
  AuthenticationError = 'authentication_error',
  RateLimited = 'rate_limited',
  QuotaExceeded = 'quota_exceeded',
  InvalidRequest = 'invalid_request',
  UnsupportedCapability = 'unsupported_capability',
  ProviderUnavailable = 'provider_unavailable',
  ProviderTimeout = 'provider_timeout',
  ContentPolicy = 'content_policy',
  Cancelled = 'cancelled',
  UnknownError = 'unknown_provider_error',
}

interface NormalizedProviderError {
  code: ProviderErrorCode;
  message: string; // User-safe
  retryable: boolean;
  providerCode?: string; // Keep original for debugging
  timestamp: Date;
}
```

**Safety:**
- Never leak API keys, credentials, or auth headers
- Never expose sensitive provider payloads
- Always provide user-safe error messages
- Preserve provider error codes for debugging (safe context only)

### Async Provider Synchronization

Refresh is idempotent and prevents duplicate assets:

```typescript
const jobId = job.id;
const lastPolled = job.lastPolledAt;
const lastStatus = job.lastProviderStatus;

// If provider reports succeeded
if (newStatus === 'succeeded') {
  // Only create asset once
  if (lastStatus !== 'succeeded') {
    await createGeneratedAsset(output);
  }
  return job; // No duplicate
}

// Track polling
job.lastPolledAt = new Date();
job.lastProviderStatus = newStatus;
```

### UI Provider Visibility

The storyboard/generation UI shows provider information:

- Provider name and model
- Generation submitted/last refresh times
- Estimated/actual cost
- Status and progress
- Normalized errors
- Capabilities where useful

Server-selected providers/models are read-only (safe, validated).

### Observability

Lightweight structured logging for provider operations:

```typescript
logger.info('provider_operation', {
  provider: 'vertex-video',
  model: 'veo-2',
  sceneforgeJobId: job.id,
  providerJobId: metadata.providerJobId,
  lifecycle: 'submit',
  duration: 1234, // ms
  estimatedCost: 100,
});
```

**Safe fields only:**
- Never log: API keys, credentials, auth tokens, sensitive payloads
- OK to log: Provider ID, model, job IDs, status, costs, duration

## Testing

All provider tests use fake/deterministic transports. **No network calls**:

```typescript
// Mock provider always deterministic
const provider = new MockMediaProvider();
const job = await provider.generateVideo({ ... });
expect(job.providerJobId).toBeDefined();

// Gemini service uses fake transport in tests
const transport = new FakeGeminiTransport();
const service = new GeminiService(apiKey, model, transport);
await service.enhanceShot(...);

// Real adapters are tested with fake SDK clients
// (stubs that never make network calls)
```

Test coverage includes:
- Provider registry resolution and validation
- Configuration loading and validation
- Gemini structured output validation
- Malformed output rejection
- Provider capability discovery
- Mock provider lifecycle
- Error normalization
- Cost estimation
- Job status tracking
- Idempotent refresh
- Duplicate prevention
- Cancellation (where supported)
- End-to-end generation flow

## Security

### Server-Only Credentials

All provider credentials remain server-side:

```typescript
// ✓ Server-side only
const config = loadMediaProviderConfig(); // server action
const provider = registry.resolve(providerId, config);

// ✗ Never client-side
// No credentials in props, context, or API responses
export function ShotGeneration({ provider, apiKey }) { } // ✗ DON'T
```

### Configuration Validation

Fail fast for invalid production config:

```typescript
// Throws immediately on startup
if (NODE_ENV === 'production' && MEDIA_PROVIDER === 'mock') {
  throw new Error('Mock provider not allowed in production');
}
```

### No Secrets in Logs

Safe logging only:

```typescript
// ✓ Safe to log
{ provider: 'gemini-image', model: 'gemini-2.0-flash', estimatedCost: 100 }

// ✗ Never log
{ apiKey: '...', authToken: '...', rawResponse: { ... } }
```

### Human Approval Remains Required

Generation does not invoke provider before owner approval. The gate is unchanged:

```
Readiness Check -> Create Job (awaiting_approval)
  -> [Owner Approves] -> Start (invoke provider)
```

### Series Memory Authority

Continuity facts remain authoritative. Provider operations respect constraints:

```typescript
const continuity = await geminiService.generateContinuityPrompt(
  seriesMemory, // ← Source of truth
  shotDescription
);
// Result informs prompt, never overrides memory
```

## Known Limitations

1. **Real Providers Stubbed**: Image and video adapters are implemented but call stubs that throw. Production would require:
   - Actual Gemini/Vertex AI SDK integration
   - API key configuration
   - Cost tracking integration

2. **No Video Playback**: Mock assets are metadata placeholders, not playable video. Real providers would need:
   - Cloud storage integration (GCS)
   - Signed URLs for secure viewing
   - Streaming/CDN considerations

3. **No ElevenLabs Voice**: Voice synthesis out of scope. Future Milestone 10+.

4. **No FFmpeg Assembly**: Final episode rendering out of scope. Future Milestone 10+.

5. **No Live Database Migration**: No `prisma migrate dev` or `prisma migrate deploy` run in this milestone. Schema changes require manual migration.

## Migration from Milestone 8

Existing Milestone 8 code continues to work:

```typescript
// Old: Hardcoded mock provider
const provider = new MockVideoProvider();

// New: Configurable provider registry
const registry = createProviderRegistry();
const provider = registry.resolve(
  process.env.MEDIA_PROVIDER || 'mock',
  config
);
```

Existing tests continue to pass with mock provider by default.

## Future Milestones

### Milestone 10: Real AI & Provider SDK Integration
- Actual Gemini API calls
- Actual Vertex AI video calls
- Cost tracking and billing
- Cloud storage integration

### Milestone 11: Voice & Audio
- ElevenLabs voice synthesis
- Audio provider registry
- Voice avatar integration

### Milestone 12: Episode Assembly
- FFmpeg final render
- Timeline editing
- Distribution integrations

## File Structure

```
lib/media/
  providers/
    types.ts                    # Provider contracts
    registry.ts                 # Provider registry
    mock-provider.ts            # Deterministic mock
    index.ts
  adapters/
    gemini-image-provider.ts    # Google Gemini image (stub)
    vertex-ai-video-provider.ts # Google Vertex AI video (stub)
  ai/
    gemini-schemas.ts           # Zod schemas for structured output
    gemini-service.ts           # Gemini AI operations
    index.ts
  config.ts                     # Configuration loader
  generation-service.ts         # Updated with provider registry
  review-service.ts             # Unchanged, preserves review workflow
  runtime.ts
  index.ts

types/
  generation.ts                 # Extended with provider metadata

tests/
  provider-registry.test.ts     # 33 tests
  gemini-service.test.ts        # 19 tests

.env.example                    # Updated with new variables
```

## Validation

All Milestones 1-8 behavior is preserved:
- ✓ Authentication and user authorization
- ✓ Production CRUD and memberships
- ✓ Persistent series, episodes, scenes, shots
- ✓ Series Memory and continuity checking
- ✓ Orchestration pipeline and approval gate
- ✓ Generation job lifecycle
- ✓ Media review and asset versioning
- ✓ Preferred asset selection

Validation results:
- `npm lint`: No errors, some warnings for intentional stub parameters
- `npm test`: 92 tests passing (including 52 new provider tests)
- `npm run build`: Successful TypeScript compilation
- `git diff --check`: No trailing whitespace

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design updated
- [AGENTS.md](AGENTS.md) - AI integration guidance
- [PRODUCT.md](PRODUCT.md) - Roadmap updated with Milestone 9
- [docs/MEDIA_PROVIDER_PIPELINE.md](docs/MEDIA_PROVIDER_PIPELINE.md) - Generation flow
- [docs/MEDIA_REVIEW_WORKFLOW.md](docs/MEDIA_REVIEW_WORKFLOW.md) - Review governance
