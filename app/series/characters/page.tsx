'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { CharacterCard } from '@/components/characters/character-card';
import { EMPIRE_OF_LIES_SERIES } from '@/lib/mock';

export default function CharactersPage() {
  const characters = EMPIRE_OF_LIES_SERIES.characters;

  return (
    <MainLayout>
      <div className="p-8">
        <Link href="/" className="mb-6 text-amber-400 hover:text-amber-300">
          ← Back to Dashboard
        </Link>

        <div className="mb-8">
          <h2 className="text-4xl font-bold text-amber-400">
            {EMPIRE_OF_LIES_SERIES.title}
          </h2>
          <p className="mt-2 text-stone-400">Characters</p>
        </div>

        <div className="grid gap-6 grid-cols-2">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>

        {/* Character Details Section */}
        <section className="mt-12">
          <h3 className="mb-6 text-2xl font-semibold">Character DNA</h3>
          <div className="space-y-6">
            {characters.map((character) => (
              <div
                key={character.id}
                className="rounded border border-stone-700 bg-stone-900 p-6"
              >
                <h4 className="mb-4 text-lg font-semibold text-amber-400">
                  {character.name}
                </h4>
                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <p className="text-xs text-stone-400">Appearance</p>
                    <p className="mt-1 text-sm text-stone-200">{character.appearance}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Personality</p>
                    <p className="mt-1 text-sm text-stone-200">{character.personality}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Wardrobe</p>
                    <p className="mt-1 text-sm text-stone-200">{character.wardrobe}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Voice</p>
                    <p className="mt-1 text-sm text-stone-200">
                      {character.voiceProfile.tone} - {character.voiceProfile.pace}
                    </p>
                  </div>
                </div>

                {character.relationships.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-stone-700">
                    <p className="mb-2 text-xs text-stone-400">Relationships</p>
                    <ul className="space-y-1 text-sm text-stone-300">
                      {character.relationships.map((rel) => (
                        <li key={rel.characterId}>
                          <span className="text-amber-300 font-medium">
                            {rel.relationshipType}:
                          </span>{' '}
                          {rel.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {character.continuityNotes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-stone-700">
                    <p className="mb-2 text-xs text-stone-400">Continuity Notes</p>
                    <ul className="space-y-1 text-sm text-stone-300">
                      {character.continuityNotes.map((note, idx) => (
                        <li key={idx}>• {note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
