# Series Memory System

## Overview

Series Memory is the central knowledge base for a production. It tracks all creative decisions, character details, world state, and story facts in a time-scoped, queryable way. Unlike a giant JSON blob, facts are stored individually with validity ranges, allowing the system to understand when things changed and why.

## Components

### 1. Character Memory (Character DNA)

Stores all character-specific information:

```typescript
interface CharacterDNA {
  characterId: string;
  face?: string;              // Facial features, scars, marks
  appearance?: string;        // Overall look and physique
  hair?: string;             // Hair color, style, texture
  wardrobe?: string;         // Typical clothing, signature items
  voice?: string;            // Voice type, accent, patterns
  personality?: string;      // Core personality traits
  relationships?: Record<string, string>;  // Key relationships
  injuries?: string[];       // Current injuries and conditions
  possessions?: string[];    // Important items/equipment
  facts: ContinuityFact[];   // Time-scoped facts about this character
}
```

**Example Facts**:
- "Marcus wears a custom Rolex watch" (Ep 1-60)
- "Marcus has a scar on left temple" (Ep 1-60)
- "Isabella wears diamond necklace" (Ep 1-60)
- "Sophia knows about her father's embezzlement" (Ep 12+)

### 2. World Memory (World DNA)

Stores all location and world-specific information:

```typescript
interface LocationDNA {
  locationId: string;
  name: string;
  description: string;
  rooms?: Record<string, RoomDetails>;  // Specific rooms
  vehicles?: string[];                  // Available vehicles
  props?: Record<string, string>;       // Props and objects
  lighting?: string;                    // Typical lighting
  visualStyle?: string;                 // Visual theme
  facts: ContinuityFact[];              // Time-scoped facts
}
```

**Example Facts**:
- "Penthouse has floor-to-ceiling windows" (Ep 1-20)
- "Office overlooks sunny street" (Ep 5, Scene 1-10)
- "Restaurant has private booth" (All)

### 3. Story Memory (Story DNA)

Stores narrative and plot information:

```typescript
interface StoryDNA {
  seriesId: string;
  secrets: StoryFact[];                          // Revelations and secrets
  relationships: Record<string, string>;         // Character dynamics
  timeline: Record<number, string[]>;            // Event log
  plotPoints: string[];                          // Key story beats
  unresolvedPlots: string[];                     // Hanging threads
  facts: ContinuityFact[];                       // Story-level facts
}
```

**Example Facts**:
- Secret: "Isabella is having an affair" (revealed Ep 8)
- Secret: "Marcus has embezzled funds" (discovered Ep 12)
- Relationship: "Julian and Marcus are rivals" (Ep 1-60)
- Timeline Event: "Ep 5: Business deal falls through" (Ep 5)

## Continuity Facts

The core unit of Series Memory is the **ContinuityFact**:

```typescript
interface ContinuityFact {
  id: string;
  seriesId: string;
  subjectType: 'character' | 'location' | 'prop' | 'story' | 'relationship' | 'status';
  subjectId: string;
  key: string;                      // What aspect (e.g., "wardrobe_color")
  value: string;                    // What value (e.g., "red_dress")
  validFromEpisode: number;         // When this becomes true
  validFromScene?: number;          // (optional) Specific scene
  validFromShot?: number;           // (optional) Specific shot
  validToEpisode?: number;          // When this stops being true
  validToScene?: number;            // (optional) When in that episode
  validToShot?: number;             // (optional) Specific shot range
  source: string;                   // Who documented this (e.g., "costume design")
  confidence: number;               // 0-1: How sure are we?
  override?: boolean;               // Force override violations
}
```

### Time Scoping

Facts can be valid for:
- Entire series: `validFromEpisode: 1` (no validTo)
- Multiple episodes: `validFromEpisode: 5, validToEpisode: 15`
- Single episode: `validFromEpisode: 5, validToEpisode: 5`
- Scene range: `validFromEpisode: 5, validFromScene: 3, validToEpisode: 5, validToScene: 8`
- Specific shot: `validFromEpisode: 5, validFromScene: 1, validFromShot: 3`

This allows precise continuity tracking without massive data duplication.

### Confidence Scoring

Each fact has a confidence level (0-1):
- 0.95-1.0: High confidence (verified by director)
- 0.7-0.95: Good confidence (from production notes)
- 0.5-0.7: Medium confidence (inferred from script)
- 0.0-0.5: Low confidence (guessed or uncertain)

The Continuity Checker uses confidence to rate violation severity.

## Continuity Checking

The `ContinuityChecker` class validates shots against facts:

```typescript
const checker = new ContinuityChecker();

// Check a single shot
const violations = checker.checkShot(
  shot,
  episodeNumber,
  sceneNumber,
  activeFacts
);

// Check multiple shots
const allViolations = checker.checkShots(
  shots,
  episodeNumber,
  sceneNumber,
  activeFacts
);

// Get active facts for a time/place
const active = checker.getActiveFacts(
  allFacts,
  episodeNumber,
  sceneNumber,
  shotNumber
);
```

### Violation Types

1. **Missing Fact**: No continuity fact exists for a required element
2. **Mismatch**: Expected value doesn't match active fact
3. **Obsolete**: Fact is no longer valid at this time
4. **Conflicting**: Multiple facts contradict each other

### Severity Levels

- **Critical**: High-confidence fact violated (e.g., character death)
- **High**: Medium-to-high confidence fact violated
- **Medium**: Moderate confidence fact violated
- **Low**: Low confidence fact or minor detail

## Usage Patterns

### Adding a Character

```typescript
const characterMemory = new CharacterMemory();

characterMemory.addCharacter('char_1_marcus', {
  appearance: 'Tall, sharp features, salt-and-pepper hair',
  wardrobe: 'Tailored suits',
  personality: 'Ruthless, charismatic',
});

// Add a fact
characterMemory.updateCharacterFact('char_1_marcus', {
  id: 'cont_1_rolex',
  subjectType: 'character',
  subjectId: 'char_1_marcus',
  key: 'marcus_wearing_rolex',
  value: 'true',
  validFromEpisode: 1,
  source: 'prop master',
  confidence: 0.95,
});
```

### Tracking Story Changes

```typescript
const storyMemory = new StoryMemory();

// Add a secret
storyMemory.addSecret('series_1', {
  id: 'fact_affair',
  type: 'secret',
  description: 'Isabella affair',
  revealedInEpisode: 8,
  affectedCharacterIds: ['char_2_isabella'],
  relatedFactIds: [],
});

// Add timeline events
storyMemory.addTimelineEvent('series_1', 5, 'Business deal fails');
storyMemory.addTimelineEvent('series_1', 8, 'Affair discovered');
storyMemory.addTimelineEvent('series_1', 12, 'Embezzlement revealed');
```

### Checking for Violations

```typescript
const checker = new ContinuityChecker();
const activeFacts = checker.getActiveFacts(
  allFacts,
  episodeNumber,
  sceneNumber,
  shotNumber
);

const violations = checker.checkShot(
  shot,
  episodeNumber,
  sceneNumber,
  activeFacts
);

violations.forEach(violation => {
  console.log(`${violation.severity}: ${violation.description}`);
  if (violation.suggestedFix) {
    console.log(`Fix: ${violation.suggestedFix}`);
  }
});
```

## Best Practices

1. **Source Everything**: Always document where facts come from (script, production, etc.)
2. **Use Confidence**: Be explicit about how certain each fact is
3. **Time-Scope Precisely**: Use the most specific time range needed
4. **Override with Intention**: Set `override: true` only for deliberate changes
5. **Review Regularly**: Check for violations before shooting each scene
6. **Update Timeline**: Keep story events synchronized with episodes
7. **Cross-Reference**: Link related facts and secrets

## Integration Points

- **Script Parsing**: Extract facts from episode scripts
- **Continuity Reports**: Generate before/after each episode
- **VFX Notes**: Embed visual continuity requirements
- **Wardrobe**: Link to costume change tracking
- **Props**: Link to prop lifecycle
- **Location Scouts**: Link to location state and changes
- **Drama Scoring**: Use facts to influence scores

## Future Enhancements

- AI extraction of facts from scripts
- Automatic violation prediction
- Visual timeline editor
- Collaborative fact editing
- Integration with scheduling tools
- Analytics on continuity violations
