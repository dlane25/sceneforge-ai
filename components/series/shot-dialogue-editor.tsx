'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';

export const SHOT_DIALOGUE_MAX_LENGTH = 2000;

export type ShotDialogueCharacter = { id: string; name: string };
export type ShotDialogueValue = { id: string; dialogue?: string; characterIds: string[] };
export type ShotDialoguePatch = { dialogue: string; characterIds: string[] };

export function initialShotDialogueDraft(shot: ShotDialogueValue, characters: ShotDialogueCharacter[]): ShotDialoguePatch {
  const persistedSpeakerId = shot.characterIds[0];
  return {
    dialogue: shot.dialogue || '',
    characterIds: persistedSpeakerId && characters.some((character) => character.id === persistedSpeakerId) ? [persistedSpeakerId] : [],
  };
}

export function buildShotDialoguePatch(dialogue: string, speakerId: string, characters: ShotDialogueCharacter[]): ShotDialoguePatch {
  const trimmedDialogue = dialogue.trim();
  if (trimmedDialogue.length > SHOT_DIALOGUE_MAX_LENGTH) throw new Error(`Dialogue must be ${SHOT_DIALOGUE_MAX_LENGTH} characters or fewer.`);
  if (speakerId && !characters.some((character) => character.id === speakerId)) throw new Error('The selected speaker is no longer available in this production.');
  return { dialogue: trimmedDialogue, characterIds: speakerId ? [speakerId] : [] };
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.error?.message || 'Unable to save shot dialogue.';
  } catch {
    return 'Unable to save shot dialogue.';
  }
}

export async function saveShotDialogue(
  url: string,
  patch: ShotDialoguePatch,
  request: typeof fetch = fetch,
): Promise<ShotDialogueValue> {
  const response = await request(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await responseMessage(response));
  return (await response.json()).data;
}

export function replaceSavedShot<T extends ShotDialogueValue>(shots: T[], saved: ShotDialogueValue): T[] {
  return shots.map((shot) => shot.id === saved.id ? { ...shot, ...saved } : shot);
}

export function ShotDialogueEditor({
  shot,
  characters,
  endpoint,
  onSaved,
}: {
  shot: ShotDialogueValue;
  characters: ShotDialogueCharacter[];
  endpoint: string;
  onSaved: (shot: ShotDialogueValue) => void;
}) {
  const [speakerId, setSpeakerId] = useState(() => initialShotDialogueDraft(shot, characters).characterIds[0] || '');
  const [dialogue, setDialogue] = useState(shot.dialogue || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const persistedSpeakerMissing = Boolean(shot.characterIds[0] && !characters.some((character) => character.id === shot.characterIds[0]));

  async function save() {
    setMessage('');
    setError('');
    let patch: ShotDialoguePatch;
    try {
      patch = buildShotDialoguePatch(dialogue, speakerId, characters);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save shot dialogue.');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveShotDialogue(endpoint, patch);
      const draft = initialShotDialogueDraft(saved, characters);
      setSpeakerId(draft.characterIds[0] || '');
      setDialogue(draft.dialogue);
      onSaved(saved);
      setMessage('Dialogue and speaker saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save shot dialogue.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="mt-4 border-t border-stone-800 pt-4" aria-label="Shot dialogue editor">
    <div className="grid gap-3 md:grid-cols-[minmax(12rem,0.4fr)_minmax(16rem,1fr)]">
      <label className="text-xs text-stone-400">Speaker
        <select
          value={speakerId}
          onChange={(event) => { setSpeakerId(event.target.value); setMessage(''); setError(''); }}
          disabled={saving}
          className="mt-1 block w-full border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-200 disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
        <span className="mt-1 block text-[11px] text-stone-600">The selected character is stored first and used as the dialogue speaker.</span>
      </label>
      <label className="text-xs text-stone-400">Dialogue
        <textarea
          value={dialogue}
          onChange={(event) => { setDialogue(event.target.value); setMessage(''); setError(''); }}
          maxLength={SHOT_DIALOGUE_MAX_LENGTH}
          rows={3}
          disabled={saving}
          placeholder="Enter this shot's spoken dialogue."
          className="mt-1 block w-full resize-y border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-200 disabled:opacity-50"
        />
        <span className="mt-1 block text-[11px] text-stone-600">{dialogue.length}/{SHOT_DIALOGUE_MAX_LENGTH} characters</span>
      </label>
    </div>
    {persistedSpeakerMissing && <p role="alert" className="mt-2 text-xs text-amber-300">The previously assigned character is no longer available. Select a current character or save as unassigned.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => { void save(); }}
        disabled={saving}
        aria-busy={saving}
        className="inline-flex items-center gap-1 rounded border border-amber-700 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-50"
      ><Save size={12} /> {saving ? 'Saving…' : 'Save dialogue'}</button>
      {message && <p role="status" className="text-xs text-emerald-400">{message}</p>}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  </div>;
}
