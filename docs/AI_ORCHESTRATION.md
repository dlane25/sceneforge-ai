# AI Orchestration

## Pipeline Contract

SceneForge AI coordinates a typed production pipeline:

```text
Series Concept
  -> Showrunner
  -> Writer
  -> Director
  -> Continuity
  -> Drama Scoring
  -> Human Approval
  -> Mock Generation Job
```

The deterministic Milestone 2 agents are intentionally model-free. Their contracts are in `lib/agents/types.ts`; `OrchestrationService` passes typed outputs between stages and records every execution.

## Agent Responsibilities

- **ShowrunnerAgent**: turns the series concept and bible into season intelligence, characters, locations, beats, outlines, and unresolved threads.
- **WriterAgent**: turns an outline into a 60-90 second screenplay while carrying relevant Series Memory references.
- **DirectorAgent**: turns a screenplay into caption-safe, portrait-first 9:16 shots and generation prompts.
- **ContinuityAgent**: wraps the Milestone 1 rule checker and returns structured findings without changing canon.
- **ScoringAgent**: wraps deterministic Drama Score and adds pacing and recommendations.

## Safety and Approval

The pipeline enters `READY_FOR_APPROVAL` after analysis. `queueGeneration()` rejects all other states, including draft, failed, rejected, and pending approval. Approval records the requested action, summary, projected impact, and decision note. Rejection ends the run; revision requests return it to `DRAFT`.

## Replacing Deterministic Agents

Gemini or Vertex AI can be introduced as adapters that implement the existing `Agent<TInput, TOutput>` contract. The adapter should:

1. Validate model output with the same Zod/domain schemas.
2. Return concise explanations and confidence values, never private chain-of-thought.
3. Map provider failures to `AgentError` with retryability.
4. Preserve the same inputs and outputs consumed by orchestration.
5. Keep provider credentials in environment variables.

No UI, pipeline state, approval logic, or video provider contract should need to change when a real model is introduced.