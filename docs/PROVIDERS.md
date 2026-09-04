# Video Providers Documentation

## Overview

SceneForge AI uses a provider-neutral interface for video generation. This allows swapping between different video generation services without changing application code.

## Provider Interface

All video providers implement the `VideoProvider` interface:

```typescript
interface VideoProvider {
  generateShot(input: VideoGenerationInput): Promise<GenerationJob>;
  extendShot(input: VideoExtensionInput): Promise<GenerationJob>;
  imageToVideo(input: ImageToVideoInput): Promise<GenerationJob>;
  getStatus(jobId: string): Promise<GenerationStatus>;
  estimateCost(input: VideoGenerationInput): Promise<number>;
}
```

## Input/Output Types

### VideoGenerationInput

```typescript
interface VideoGenerationInput {
  prompt: string;                           // Text description
  duration: number;                         // Seconds
  aspectRatio?: '9:16' | '16:9' | '1:1';   // Video format
  style?: string;                           // Visual style
  model?: string;                           // Specific model
}
```

### VideoExtensionInput

```typescript
interface VideoExtensionInput {
  videoId: string;                          // Existing video
  prompt: string;                           // Extension description
  duration: number;                         // Additional seconds
  position?: 'start' | 'end';               // Where to add
}
```

### ImageToVideoInput

```typescript
interface ImageToVideoInput {
  imageUrl: string;                         // Starting image
  prompt: string;                           // Animation description
  duration: number;                         // Video duration
  motion?: string;                          // Motion type
}
```

### GenerationStatus

```typescript
interface GenerationStatus {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress?: number;                        // 0-100%
  outputUrl?: string;                       // Result URL
  errorMessage?: string;
}
```

## Supported Providers

### MockVideoProvider (Built-in)

Deterministic mock implementation for development.

**Features**:
- No actual video generation (returns mock URLs)
- Deterministic behavior based on prompt hash
- Simulated cost calculation
- Status progression simulation
- 95% success rate (5% simulated failures)

**Configuration**:
```typescript
import { createMockVideoProvider } from '@/lib/video/mock-provider';

const provider = createMockVideoProvider();
const job = await provider.generateShot({
  prompt: 'A character walks into a room',
  duration: 5,
  aspectRatio: '9:16',
});
```

**Use Cases**:
- Development and testing
- Milestone 1 (no paid APIs)
- UI/UX prototyping
- Performance testing

### Future Providers (Ready to Implement)

#### Veo (Google)
- Recommended primary provider
- High quality, 1080p+
- Fast generation
- Cost-effective

#### Kling (Kuaishou)
- Excellent for 9:16 format
- Strong character consistency
- Asian market leader
- Competitive pricing

#### Seedance
- Specialized in stylized content
- Great for artistic dramas
- Premium quality
- Higher cost

#### Runway
- Established platform
- Multiple model options
- Good editing tools
- Industry standard

#### Pika
- New player
- Competitive features
- Fast iteration
- Emerging alternative

## Provider Selection Strategy

**For Milestone 1**: MockVideoProvider only
**For Milestone 2**: Add Veo as primary
**Future**: Support multiple providers with cost/quality tradeoffs

## Provider Implementation Guide

To implement a new provider:

1. **Create provider class** implementing `VideoProvider`
2. **Implement all methods** (generateShot, extendShot, imageToVideo, getStatus, estimateCost)
3. **Handle API authentication** via environment variables
4. **Implement error handling** with descriptive messages
5. **Track costs** for each generation
6. **Cache responses** appropriately
7. **Add comprehensive tests**

### Example Implementation Template

```typescript
import type { VideoProvider, VideoGenerationInput, GenerationStatus } from './index';
import type { GenerationJob } from '@/types';

export class MyVideoProvider implements VideoProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.example.com';
  }

  async generateShot(input: VideoGenerationInput): Promise<GenerationJob> {
    // Implementation here
  }

  async extendShot(input: VideoExtensionInput): Promise<GenerationJob> {
    // Implementation here
  }

  async imageToVideo(input: ImageToVideoInput): Promise<GenerationJob> {
    // Implementation here
  }

  async getStatus(jobId: string): Promise<GenerationStatus> {
    // Implementation here
  }

  async estimateCost(input: VideoGenerationInput): Promise<number> {
    // Implementation here
  }
}
```

## Configuration

### Environment Variables

```env
# Video Provider
VIDEO_PROVIDER=mock  # or: veo, kling, seedance, runway

# Provider-specific keys (only set if needed)
VEO_API_KEY=xxx
KLING_API_KEY=xxx
SEEDANCE_API_KEY=xxx
RUNWAY_API_KEY=xxx

# Cost overrides (for testing)
VIDEO_BASE_COST=100
VIDEO_COST_PER_MINUTE=50
```

### Runtime Selection

```typescript
import { MockVideoProvider } from '@/lib/video/mock-provider';
import { VeoProvider } from '@/lib/video/veo-provider';  // Future

function createVideoProvider(): VideoProvider {
  const provider = process.env.VIDEO_PROVIDER || 'mock';

  switch (provider) {
    case 'veo':
      return new VeoProvider(process.env.VEO_API_KEY!);
    case 'kling':
      return new KlingProvider(process.env.KLING_API_KEY!);
    case 'mock':
    default:
      return new MockVideoProvider();
  }
}
```

## Cost Estimation

Each provider calculates costs based on:
- **Duration**: Seconds of video
- **Quality**: Resolution and frame rate
- **Style**: Complexity of visual style
- **Model**: Different models have different costs
- **Rush**: Priority processing

Example cost formula:
```
baseCost = 100
durationMultiplier = duration / 60
styleMultiplier = hasStyle ? 1.2 : 1.0
totalCost = baseCost × durationMultiplier × styleMultiplier
```

## Error Handling

Providers must handle:
- API rate limiting
- Network timeouts
- Invalid inputs
- Quota exceeded
- Authentication failures
- Generation failures

All errors should be captured in the GenerationJob:
```typescript
{
  status: 'failed',
  errorMessage: 'API rate limit exceeded. Retry in 60 seconds.',
  retryCount: 1
}
```

## Monitoring and Analytics

Track per-provider:
- Generation success rate
- Average generation time
- Cost per video
- Model performance differences
- Error frequency

## Best Practices

1. **Retry Logic**: Implement exponential backoff for retries
2. **Timeouts**: Set reasonable timeouts (3-5 minutes for generation)
3. **Caching**: Cache successful generations to reduce costs
4. **Validation**: Validate inputs before sending to provider
5. **Fallbacks**: Have fallback providers if primary fails
6. **Testing**: Use MockVideoProvider for all tests
7. **Monitoring**: Log all API calls and errors

## Future: Provider Marketplace

Consider allowing users to:
- Select preferred provider (cost vs. quality)
- Mix providers by use case
- Set custom cost limits
- Monitor provider performance
- A/B test different providers
