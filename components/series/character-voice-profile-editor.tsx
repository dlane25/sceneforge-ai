'use client';

import { useRef, useState } from 'react';
import { Save } from 'lucide-react';
import type { VoiceProfile } from '@/types';

export const VOICE_PROFILE_LIMITS = {
  displayName: 200,
  providerVoiceId: 300,
  language: 50,
  locale: 80,
  tone: 120,
} as const;

export type VoiceProfileCharacter = { id: string; name: string; voiceProfile: VoiceProfile };
export type VoiceProfileDraft = {
  provider: '' | 'elevenlabs-voice';
  providerVoiceId: string;
  displayName: string;
  language: string;
  locale: string;
  active: boolean;
  tone: string;
  pace: VoiceProfile['pace'];
};
export type VoiceProfilePatch = {
  voiceProfile: Pick<VoiceProfile, 'provider' | 'providerVoiceId' | 'displayName' | 'active' | 'tone' | 'pace'> & Pick<Partial<VoiceProfile>, 'language' | 'locale'>;
};

export function initialVoiceProfileDraft(character: VoiceProfileCharacter): VoiceProfileDraft {
  const profile = character.voiceProfile;
  const configuredForElevenLabs = profile.provider === 'elevenlabs-voice';
  return {
    provider: configuredForElevenLabs ? 'elevenlabs-voice' : '',
    providerVoiceId: configuredForElevenLabs ? profile.providerVoiceId || '' : '',
    displayName: profile.displayName || character.name,
    language: profile.language || '',
    locale: profile.locale || '',
    active: profile.active ?? true,
    tone: profile.tone,
    pace: profile.pace,
  };
}

function checkedLength(value: string, label: string, maximum: number, minimum = 0): string {
  const trimmed = value.trim();
  if (trimmed.length < minimum) throw new Error(`${label} must be at least ${minimum} characters.`);
  if (trimmed.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return trimmed;
}

export function buildVoiceProfilePatch(draft: VoiceProfileDraft, characterName: string): VoiceProfilePatch {
  if (draft.provider !== 'elevenlabs-voice') throw new Error('Select ElevenLabs premade/catalog voice as the provider.');
  const providerVoiceId = checkedLength(draft.providerVoiceId, 'Voice ID', VOICE_PROFILE_LIMITS.providerVoiceId, 1);
  const displayName = checkedLength(draft.displayName, 'Display name', VOICE_PROFILE_LIMITS.displayName) || characterName;
  const tone = checkedLength(draft.tone, 'Tone', VOICE_PROFILE_LIMITS.tone, 1);
  const language = checkedLength(draft.language, 'Language', VOICE_PROFILE_LIMITS.language);
  if (language && language.length < 2) throw new Error('Language must be at least 2 characters.');
  const locale = checkedLength(draft.locale, 'Locale', VOICE_PROFILE_LIMITS.locale);
  if (!['slow', 'normal', 'fast'].includes(draft.pace)) throw new Error('Pace must be slow, normal, or fast.');
  return {
    voiceProfile: {
      provider: 'elevenlabs-voice',
      providerVoiceId,
      displayName,
      tone,
      pace: draft.pace,
      active: draft.active,
      ...(language ? { language } : {}),
      ...(locale ? { locale } : {}),
    },
  };
}

export async function saveCharacterVoiceProfile(
  url: string,
  patch: VoiceProfilePatch,
  request: typeof fetch = fetch,
): Promise<VoiceProfileCharacter> {
  const response = await request(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error('Unable to save voice profile.');
  return (await response.json()).data;
}

export function replaceSavedCharacter<T extends VoiceProfileCharacter>(characters: T[], saved: VoiceProfileCharacter): T[] {
  return characters.map((character) => character.id === saved.id ? { ...character, ...saved } : character);
}

export function CharacterVoiceProfileEditor({
  seriesId,
  character,
  onSaved,
}: {
  seriesId: string;
  character: VoiceProfileCharacter;
  onSaved: (character: VoiceProfileCharacter) => void;
}) {
  const initial = initialVoiceProfileDraft(character);
  const [provider, setProvider] = useState(initial.provider);
  const [providerVoiceId, setProviderVoiceId] = useState(initial.providerVoiceId);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [language, setLanguage] = useState(initial.language);
  const [locale, setLocale] = useState(initial.locale);
  const [active, setActive] = useState(initial.active);
  const [tone, setTone] = useState(initial.tone);
  const [pace, setPace] = useState<VoiceProfile['pace']>(initial.pace);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);

  function applyPersistedProfile(persistedCharacter: VoiceProfileCharacter) {
    const persisted = initialVoiceProfileDraft(persistedCharacter);
    setProvider(persisted.provider);
    setProviderVoiceId(persisted.providerVoiceId);
    setDisplayName(persisted.displayName);
    setLanguage(persisted.language);
    setLocale(persisted.locale);
    setActive(persisted.active);
    setTone(persisted.tone);
    setPace(persisted.pace);
  }

  function clearStatus() { setMessage(''); setError(''); }

  async function save() {
    if (requestInFlight.current) return;
    clearStatus();
    let patch: VoiceProfilePatch;
    try {
      patch = buildVoiceProfilePatch({ provider, providerVoiceId, displayName, language, locale, active, tone, pace }, character.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save voice profile.');
      return;
    }
    requestInFlight.current = true;
    setSaving(true);
    try {
      const saved = await saveCharacterVoiceProfile(`/api/series/${seriesId}/characters/${character.id}`, patch);
      applyPersistedProfile(saved);
      onSaved(saved);
      setMessage('Voice profile saved.');
    } catch {
      setError('Unable to save voice profile.');
    } finally {
      requestInFlight.current = false;
      setSaving(false);
    }
  }

  return <section className="mt-3 border border-stone-800 bg-stone-950 p-4" aria-label={`${character.name} voice profile`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-sm font-semibold text-amber-200">Voice profile</p><p className="mt-1 text-xs text-stone-500">Configure an existing ElevenLabs premade/catalog voice. This does not contact ElevenLabs or generate speech.</p></div>
      <span className={`text-xs ${active ? 'text-emerald-400' : 'text-amber-300'}`}>{active ? 'Active' : 'Inactive'}</span>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-xs text-stone-400">Provider
        <select value={provider} onChange={(event) => { setProvider(event.target.value as VoiceProfileDraft['provider']); clearStatus(); }} disabled={saving} className="mt-1 block w-full border border-stone-700 bg-stone-900 px-3 py-2 text-sm disabled:opacity-50">
          <option value="">Not configured</option>
          <option value="elevenlabs-voice">ElevenLabs premade/catalog voice</option>
        </select>
      </label>
      <label className="text-xs text-stone-400">Existing ElevenLabs premade/catalog voice ID
        <input value={providerVoiceId} onChange={(event) => { setProviderVoiceId(event.target.value); clearStatus(); }} maxLength={VOICE_PROFILE_LIMITS.providerVoiceId} disabled={saving} autoComplete="off" placeholder="Enter an existing provider voice ID" className="mt-1 block w-full border border-stone-700 bg-stone-900 px-3 py-2 text-sm disabled:opacity-50" />
      </label>
      <label className="text-xs text-stone-400">Display name
        <input value={displayName} onChange={(event) => { setDisplayName(event.target.value); clearStatus(); }} maxLength={VOICE_PROFILE_LIMITS.displayName} disabled={saving} className="mt-1 block w-full border border-stone-700 bg-stone-900 px-3 py-2 text-sm disabled:opacity-50" />
      </label>
      <label className="text-xs text-stone-400">Tone
        <input value={tone} onChange={(event) => { setTone(event.target.value); clearStatus(); }} maxLength={VOICE_PROFILE_LIMITS.tone} disabled={saving} className="mt-1 block w-full border border-stone-700 bg-stone-900 px-3 py-2 text-sm disabled:opacity-50" />
      </label>
      <label className="text-xs text-stone-400">Pace
        <select value={pace} onChange={(event) => { setPace(event.target.value as VoiceProfile['pace']); clearStatus(); }} disabled={saving} className="mt-1 block w-full border border-stone-700 bg-stone-900 px-3 py-2 text-sm disabled:opacity-50">
          <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
        </select>
      </label>
      <label className="text-xs text-stone-400">Language
        <input value={language} onChange={(event) => { setLanguage(event.target.value); clearStatus(); }} maxLength={VOICE_PROFILE_LIMITS.language} disabled={saving} placeholder="en" className="mt-1 block w-full border border-stone-700 bg-stone-900 px-3 py-2 text-sm disabled:opacity-50" />
      </label>
      <label className="text-xs text-stone-400">Locale
        <input value={locale} onChange={(event) => { setLocale(event.target.value); clearStatus(); }} maxLength={VOICE_PROFILE_LIMITS.locale} disabled={saving} placeholder="en-US" className="mt-1 block w-full border border-stone-700 bg-stone-900 px-3 py-2 text-sm disabled:opacity-50" />
      </label>
      <label className="flex items-center gap-2 self-end py-2 text-xs text-stone-300"><input type="checkbox" checked={active} onChange={(event) => { setActive(event.target.checked); clearStatus(); }} disabled={saving} /> Voice profile active</label>
    </div>
    {!active && <p className="mt-3 text-xs text-amber-300">Inactive voice profiles cannot be used for audio generation.</p>}
    <p className="mt-3 text-xs text-stone-600">Rights, consent, reference audio, and cloned/licensed voice governance are not editable here and remain unchanged.</p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => { void save(); }} disabled={saving} aria-busy={saving} className="inline-flex items-center gap-1 rounded border border-amber-700 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-50"><Save size={12} /> {saving ? 'Saving…' : 'Save voice profile'}</button>
      {message && <p role="status" className="text-xs text-emerald-400">{message}</p>}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  </section>;
}
