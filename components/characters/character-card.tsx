'use client';

import type { Character } from '@/types';

export function CharacterCard({ character }: { character: Character }) {
  return (
    <div className="rounded border border-stone-700 bg-stone-900 p-4 hover:border-amber-400 hover:bg-stone-800 transition">
      <h4 className="font-semibold text-amber-400">{character.name}</h4>
      <p className="mt-1 text-xs text-stone-400 capitalize">{character.role}</p>
      <div className="mt-3 space-y-1 text-xs text-stone-300">
        <p className="line-clamp-2">{character.appearance}</p>
        <p className="line-clamp-1">Personality: {character.personality}</p>
      </div>
      <div className="mt-3">
        <span className="inline-block rounded bg-amber-900/20 px-2 py-0.5 text-xs text-amber-300">
          Age {character.age}
        </span>
      </div>
    </div>
  );
}
