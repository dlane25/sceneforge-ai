import type { ContinuityFact } from '@/types';

export interface RoomDetails {
  name: string;
  description: string;
  lighting?: string;
  furniture?: string[];
  props?: string[];
}

export interface LocationDNA {
  locationId: string;
  name: string;
  description: string;
  rooms?: Record<string, RoomDetails>;
  vehicles?: string[];
  props?: Record<string, string>;
  lighting?: string;
  visualStyle?: string;
  facts: ContinuityFact[];
}

export class WorldMemory {
  private locations: Map<string, LocationDNA> = new Map();

  addLocation(locationId: string, dna: Partial<LocationDNA>): void {
    const existing = this.locations.get(locationId) || {
      locationId,
      name: dna.name || locationId,
      description: dna.description || '',
      facts: [],
    };
    this.locations.set(locationId, {
      ...existing,
      ...dna,
      facts: dna.facts || existing.facts,
    });
  }

  getLocation(locationId: string): LocationDNA | undefined {
    return this.locations.get(locationId);
  }

  updateLocationFact(
    locationId: string,
    fact: ContinuityFact
  ): void {
    const location = this.locations.get(locationId);
    if (!location) {
      this.addLocation(locationId, { facts: [fact] });
    } else {
      const existingIndex = location.facts.findIndex((f) => f.id === fact.id);
      if (existingIndex >= 0) {
        location.facts[existingIndex] = fact;
      } else {
        location.facts.push(fact);
      }
    }
  }

  getAllLocations(): LocationDNA[] {
    return Array.from(this.locations.values());
  }

  clear(): void {
    this.locations.clear();
  }
}
