# SceneForge AI - Product Document

## What is SceneForge AI?

SceneForge AI is an AI-native production studio for creating serialized vertical microdramas in 9:16 format (phone-sized videos). It enables creators to go from idea to episodic series by managing characters, continuity, story, and video generation all in one place.

## Core Features

### 1. Series Bible
Central repository for all series information:
- Series metadata (title, genre, logline, target audience, visual style)
- Complete cast of characters with detailed DNA
- Full story outline across multiple episodes
- Continuity tracking across all story elements
- Location and prop management

### 2. Character DNA System
Deeply structured character profiles:
- Physical appearance (face, hair, clothing, distinctive marks)
- Voice characteristics (tone, accent, pace, pitch)
- Personality and behavioral patterns
- Relationships with other characters
- Character-specific continuity notes
- Equipment and possessions
- Injury and status tracking

### 3. Series Memory
Persistent, scoped continuity database:
- Automatic tracking of character changes
- Location and world state snapshots
- Story events with timeline
- Time-scoped facts (valid from/to episode/scene/shot)
- Confidence scoring for facts
- Automatic violation detection

### 4. Continuity Checker
Prevents continuity mistakes:
- Analyzes shots against active continuity facts
- Detects mismatches between script and character/world DNA
- Rates violations by severity
- Suggests corrections
- Works entirely offline (no AI calls)

### 5. Video Generation
Abstracted video pipeline:
- Provider-agnostic interface
- Support for multiple generation types (shot, extend, image-to-video)
- Cost estimation and tracking
- Job status monitoring
- Deterministic mock provider for dev

### 6. Drama Scoring
Automatic quality scoring:
- Hook strength
- Conflict intensity
- Emotional impact
- Cliffhanger effectiveness
- Character consistency
- Overall composition score

### 7. Studio Dashboard
Command-center interface:
- Series overview and stats
- Character management
- Episode development
- Continuity status
- Generation job monitoring
- Memory and fact browser

### 8. AI Production Pipeline

Milestone 2 adds a staged command-center workflow for each episode:

1. Showrunner expands the series concept into production intelligence.
2. Writer creates a 60-90 second structured screenplay using Series Memory.
3. Director creates a portrait-first 9:16 shot plan.
4. Continuity checks the screenplay and shots without changing canon.
5. Drama Scoring quantifies hook, conflict, emotion, cliffhanger, continuity, pacing, and overall score.
6. A human approves or requests revision.
7. Only an approved pipeline can queue a mock generation job.

Agent activity is recorded as an audit trail with concise explanations and confidence values.

### 9. Persistent Productions and Access Control

Milestone 3 adds PostgreSQL-ready persistence for productions, memberships, characters, locations, episodes, Series Memory, orchestration runs, approvals, generation jobs, and scoring evaluations. A provider-neutral session boundary and production roles keep multiple users isolated. The local demo remains usable without PostgreSQL through deterministic in-memory repositories.

## Workflow

```
1. Create Series
   └─ Define title, logline, genre, style, target audience

2. Build Cast
   └─ Create characters with full DNA profiles
   └─ Define relationships

3. Outline Episodes
   └─ Hook, synopsis, cliffhanger
   └─ Automatic Drama Score calculation

4. Develop Scenes
   └─ Create shots with continuity requirements
   └─ Automatic violation detection

5. Generate Video
   └─ Queue shots for generation
   └─ Track jobs and costs
   └─ Monitor status

6. Edit and Polish
   └─ Review continuity violations
   └─ Update Series Memory as needed
   └─ Re-score and refine
```

## Design Philosophy

### Determinism First
All generation is deterministic during Milestone 1:
- Mock video generation produces consistent outputs
- Continuity checking has no randomness
- Drama scoring is formula-based
- Makes development and testing predictable

### No Paid APIs Yet
Milestone 1 uses only mock data:
- No OpenAI, Anthropic, or Claude calls
- No Veo, Kling, Seedance, or Runway integration
- Foundation ready to add these later

### Strict TypeScript
- Full type safety
- No `any` types
- Proper error handling
- Zod validation for user input

### Cinematic Interface
- Dark, premium aesthetic (charcoal background, warm ivory text, restrained gold accents)
- Information-dense but readable
- Responsive on desktop and mobile
- Command-center feel (not a chatbot interface)

## Demo Project: Empire of Lies

A complete demo series included to showcase all features:

### Setting
Billionaire world of wealth, power, and carefully guarded secrets.

### Plot
Marcus Sterling has built an empire of lies. When old rival Julian Ashford resurfaces, everything begins to crumble. His wife Isabella harbors dark secrets. His daughter Sophia begins to see through the facade.

### Format
- **Episodes**: 60 planned, 5 fully outlined in Milestone 1
- **Duration**: 60-90 seconds each
- **Format**: Vertical 9:16 (mobile)
- **Status**: In development

### Characters
1. **Marcus Sterling** - Ruthless billionaire protagonist
2. **Isabella Romano** - Mysterious wife with secrets
3. **Sophia Sterling** - Ambitious daughter caught in the middle
4. **Julian Ashford** - Business rival seeking revenge

### Locations
1. Sterling Penthouse - Luxury residence
2. Sterling Capital Offices - Corporate headquarters
3. Rosso Dining Room - Exclusive restaurant

### Story Elements
- Secret affair
- Hidden romance for Sophia
- Multi-year rivalry plot
- Embezzlement conspiracy
- Family betrayal and manipulation

### Continuity Challenge
The demo includes an intentional continuity violation (Episode 12-15: Marcus's signature Rolex watch disappears) to demonstrate the Continuity Checker in action.

## Monetization (Future)

Potential revenue streams:
- Per-video generation costs (pass-through from APIs)
- Monthly studio subscription (storage, collab, analytics)
- Premium features (advanced AI, priority generation)
- Creator marketplace (templates, character libraries)
- Publishing platform (built-in distribution)

## Success Metrics

- Creator retention and daily active usage
- Series completion rate (idea → published)
- Average series length and quality
- Video generation success rate
- Platform uptime and performance
- Creator satisfaction (NPS)

## Roadmap

### Milestone 1
✓ Foundation and architecture
✓ Type system
✓ Series Memory
✓ Continuity checking
✓ Drama scoring
✓ Mock providers
✓ UI dashboard

### Milestone 2
✓ Deterministic Showrunner, Writer, Director, Continuity, and Scoring agents
✓ Typed orchestration state machine and execution audit history
✓ Human approval and rejection gate before mock generation
✓ API routes and pipeline UI
✓ Prisma models for agent executions, pipeline runs, and approvals

The next milestone can replace deterministic agents with Gemini/Vertex AI adapters without changing domain contracts.

### Milestone 4 (Current)
✓ Auth.js production adapter behind the existing auth abstraction
✓ Deterministic local/test authentication fallback
✓ Idempotent user provisioning and email-linked invited identities
✓ Authenticated production list/create/view/update/archive flows
✓ OWNER, EDITOR, and VIEWER membership management
✓ Last-owner protection and server-side tenant isolation
✓ Production settings and membership UI

### Milestone 5 (Current)
✓ Structured production data foundation
✓ Character, location, episode, scene, and story-fact CRUD
✓ Prisma and deterministic in-memory repository implementations
✓ Production-scoped validation and cross-entity invariants
✓ Production data workspace UI
✓ Series Memory integration through persistent fact contracts

### Milestone 6 (Current)
✓ Provider-neutral persisted shot model
✓ Deterministic storyboard placeholders
✓ Shot CRUD and reordering APIs
✓ Shot generation-readiness evaluation
✓ Persisted shots and story facts available to orchestration context
✓ Storyboard production workspace UI

### Milestone 7 (Current)
✓ Approval-governed provider-neutral media job lifecycle
✓ Deterministic mock media provider with status and cancellation
✓ Persisted generation jobs and generated assets
✓ Cost estimation, retry, and generated asset review states

### Milestone 8 (Current)
✓ Human media review and rejection workflow
✓ Asset version history and preferred asset selection
✓ Continuity-aware approval enforcement
✓ Deterministic metadata comparison and review audit history

### Milestone 3 (Current)
✓ Normalized Prisma/PostgreSQL production schema
✓ Repository interfaces with Prisma and deterministic in-memory adapters
✓ Persistent orchestration and approval state boundary
✓ Provider-neutral authentication foundation
✓ OWNER, EDITOR, and VIEWER production authorization
✓ Server-side API access checks and sanitized errors

### Milestone 3
- Advanced story generation
- Character voice synthesis
- Analytics and performance tracking
- Collaborative editing
- Publishing integrations

### Milestone 4+
- Multi-language support
- Advanced analytics
- Creator marketplace
- Platform monetization
- Mobile app
