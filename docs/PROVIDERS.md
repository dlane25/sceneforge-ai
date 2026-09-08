# Provider contracts

SceneForge media generation uses `MediaProvider` and `ProviderRegistry` from `lib/media/providers`. The application never imports a vendor SDK from a route or component. Vendor behavior lives behind Gemini image, Vertex video, and ElevenLabs voice adapters and their transport interfaces.

## Stable providers

| ID | Media | Lifecycle | Cancellation |
| --- | --- | --- | --- |
| `mock` | image, video, and speech | deterministic polling | supported |
| `gemini-image` | text-to-image | synchronous result | unsupported |
| `vertex-video` | text-to-video | asynchronous polling | unsupported by current RPC adapter |
| `elevenlabs-voice` | text-to-speech | synchronous result | unsupported |

Every provider implements generation methods, status polling, capability discovery, cost estimation, and typed unsupported operations. Capabilities explicitly declare speech, voice cloning, sound effects, and caption support; no provider silently emulates an unsupported operation. Requests are validated before transport calls. Output is normalized to URI, MIME type, dimensions or audio encoding metadata, duration, checksum/size when available, and safe metadata.

## Adding a provider

1. Add a stable ID and capability declaration to `lib/media/providers/types.ts` and `registry.ts`.
2. Implement a transport interface in `lib/media/providers/transport.ts`; keep HTTP/SDK details out of the provider contract.
3. Normalize provider errors with `ProviderOperationError` and redact secrets.
4. Add configuration validation and a factory entry in `ProviderRegistry`.
5. Add deterministic or fake-transport contract tests. Tests must not make network calls.
6. Route execution through `GenerationService` or `AudioGenerationService`; never bypass the owner approval gate.

## Configuration boundary

Provider credentials and Google ADC remain server-only. Use `.env.example` as the variable reference. Production requires explicit non-mock image, video, and audio providers plus all provider-specific configuration; local/test use requires explicit mock mode.

## Governance

`GenerationService` snapshots the request and estimate before approval, stores provider/job metadata, polls idempotently, and preserves generated asset history. A provider may not approve assets or change preferred review state. Unsupported capabilities return normalized errors rather than silently falling back.
