import type { ContinuityFact } from '@/types';

export interface CharacterDNA {
  characterId: string;
  face?: string;
  appearance?: string;
  hair?: string;
  wardrobe?: string;
  voice?: string;
  personality?: string;
  relationships?: Record<string, string>;
  injuries?: string[];
  possessions?: string[];
  facts: ContinuityFact[];
}

export class CharacterMemory {
  private characters: Map<string, CharacterDNA> = new Map();

  addCharacter(characterId: string, dna: Partial<CharacterDNA>): void {
    const existing = this.characters.get(characterId) || { characterId, facts: [] };
    this.characters.set(characterId, {
      ...existing,
      ...dna,
      facts: dna.facts || existing.facts,
    });
  }

  getCharacter(characterId: string): CharacterDNA | undefined {
    return this.characters.get(characterId);
  }

  updateCharacterFact(
    characterId: string,
    fact: ContinuityFact
  ): void {
    const character = this.characters.get(characterId);
    if (!character) {
      this.addCharacter(characterId, { facts: [fact] });
    } else {
      const existingIndex = character.facts.findIndex((f) => f.id === fact.id);
      if (existingIndex >= 0) {
        character.facts[existingIndex] = fact;
      } else {
        character.facts.push(fact);
      }
    }
  }

  getAllCharacters(): CharacterDNA[] {
    return Array.from(this.characters.values());
  }

  clear(): void {
    this.characters.clear();
  }
}
