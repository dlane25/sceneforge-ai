import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildVoiceProfilePatch,
  CharacterVoiceProfileEditor,
  initialVoiceProfileDraft,
  replaceSavedCharacter,
  saveCharacterVoiceProfile,
  VOICE_PROFILE_LIMITS,
  type VoiceProfileCharacter,
  type VoiceProfileDraft,
} from '@/components/series/character-voice-profile-editor';
import { characterPatchSchema } from '@/lib/validation/schemas';

const character: VoiceProfileCharacter = {
  id: 'character_maya',
  name: 'Maya Chen',
  voiceProfile: {
    provider: 'elevenlabs-voice',
    providerVoiceId: 'catalog_voice_test',
    displayName: 'Maya production voice',
    language: 'en',
    locale: 'en-US',
    active: false,
    tone: 'measured',
    pace: 'slow',
    stability: 0.6,
    reference: { referenceId: 'preserved-reference' },
    rights: { sourceType: 'licensed', rightsConfirmed: false, consentConfirmed: false, approvalState: 'pending' },
  },
};

function validDraft(overrides: Partial<VoiceProfileDraft> = {}): VoiceProfileDraft {
  return {
    provider: 'elevenlabs-voice',
    providerVoiceId: '  catalog_voice_configured  ',
    displayName: '  Maya Catalog Voice  ',
    language: '  en  ',
    locale: '  en-US  ',
    active: true,
    tone: '  warm  ',
    pace: 'normal',
    ...overrides,
  };
}

describe('character voice profile editor', () => {
  it('initializes every owned field from the persisted voice profile', () => {
    expect(initialVoiceProfileDraft(character)).toEqual({
      provider: 'elevenlabs-voice',
      providerVoiceId: 'catalog_voice_test',
      displayName: 'Maya production voice',
      language: 'en',
      locale: 'en-US',
      active: false,
      tone: 'measured',
      pace: 'slow',
    });
    const markup = renderToStaticMarkup(createElement(CharacterVoiceProfileEditor, { seriesId: 'series_1', character, onSaved: () => undefined }));
    expect(markup).toContain('value="elevenlabs-voice" selected=""');
    expect(markup).toContain('value="catalog_voice_test"');
    expect(markup).toContain('value="Maya production voice"');
    expect(markup).toContain('value="slow" selected=""');
    expect(markup).toContain('Inactive voice profiles cannot be used for audio generation.');
  });

  it('keeps provider-neutral and mock characters unconfigured for ElevenLabs', () => {
    const draft = initialVoiceProfileDraft({ id: 'character_new', name: 'New Character', voiceProfile: { provider: 'mock', providerVoiceId: 'mock-only-id', tone: 'neutral', pace: 'normal' } });
    expect(draft).toMatchObject({ provider: '', providerVoiceId: '', displayName: 'New Character', tone: 'neutral', pace: 'normal' });
  });

  it('initializes and validates an explicitly saved Google Chirp profile without auto-configuring it', () => {
    const google = { ...character, voiceProfile: { ...character.voiceProfile, provider: 'google-cloud-tts' as const, providerVoiceId: 'en-US-Chirp3-HD-TestVoice', language: 'en-US' } };
    expect(initialVoiceProfileDraft(google)).toMatchObject({ provider: 'google-cloud-tts', providerVoiceId: 'en-US-Chirp3-HD-TestVoice', language: 'en-US' });
    expect(buildVoiceProfilePatch(validDraft({ provider: 'google-cloud-tts', providerVoiceId: 'en-US-Chirp3-HD-TestVoice', language: 'en-US', locale: 'en-US' }), character.name)).toMatchObject({ voiceProfile: { provider: 'google-cloud-tts', providerVoiceId: 'en-US-Chirp3-HD-TestVoice', language: 'en-US' } });
    expect(() => buildVoiceProfilePatch(validDraft({ provider: 'google-cloud-tts', providerVoiceId: 'en-US-Chirp3-HD-TestVoice', language: 'fr-FR' }), character.name)).toThrow('must match');
    expect(() => buildVoiceProfilePatch(validDraft({ provider: 'google-cloud-tts', providerVoiceId: 'catalog-id', language: 'en-US' }), character.name)).toThrow('complete Chirp');
  });

  it('builds the exact valid PATCH payload from trimmed editor-owned fields', () => {
    const patch = buildVoiceProfilePatch(validDraft(), character.name);
    expect(patch).toEqual({
      voiceProfile: {
        provider: 'elevenlabs-voice',
        providerVoiceId: 'catalog_voice_configured',
        displayName: 'Maya Catalog Voice',
        language: 'en',
        locale: 'en-US',
        active: true,
        tone: 'warm',
        pace: 'normal',
      },
    });
    expect(characterPatchSchema.safeParse(patch).success).toBe(true);
    expect(patch.voiceProfile).not.toHaveProperty('rights');
    expect(patch.voiceProfile).not.toHaveProperty('reference');
    expect(patch.voiceProfile).not.toHaveProperty('stability');
  });

  it('rejects a blank voice ID and invalid field values', () => {
    expect(() => buildVoiceProfilePatch(validDraft({ providerVoiceId: '   ' }), character.name)).toThrow('Voice ID');
    expect(() => buildVoiceProfilePatch(validDraft({ provider: '' }), character.name)).toThrow('supported production');
    expect(() => buildVoiceProfilePatch(validDraft({ displayName: 'x'.repeat(VOICE_PROFILE_LIMITS.displayName + 1) }), character.name)).toThrow('Display name');
    expect(() => buildVoiceProfilePatch(validDraft({ providerVoiceId: 'x'.repeat(VOICE_PROFILE_LIMITS.providerVoiceId + 1) }), character.name)).toThrow('Voice ID');
    expect(() => buildVoiceProfilePatch(validDraft({ language: 'e' }), character.name)).toThrow('Language');
    expect(() => buildVoiceProfilePatch(validDraft({ locale: 'x'.repeat(VOICE_PROFILE_LIMITS.locale + 1) }), character.name)).toThrow('Locale');
    expect(() => buildVoiceProfilePatch(validDraft({ tone: '   ' }), character.name)).toThrow('Tone');
    expect(() => buildVoiceProfilePatch(validDraft({ pace: 'variable' as VoiceProfileDraft['pace'] }), character.name)).toThrow('Pace');
  });

  it('uses the authenticated nested PATCH endpoint contract without provider calls', async () => {
    const patch = buildVoiceProfilePatch(validDraft(), character.name);
    const saved = { ...character, voiceProfile: { ...character.voiceProfile, ...patch.voiceProfile } };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: saved }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(saveCharacterVoiceProfile('/api/series/series_1/characters/character_maya', patch, request)).resolves.toEqual(saved);
    expect(request).toHaveBeenCalledWith('/api/series/series_1/characters/character_maya', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
  });

  it('replaces successful persisted character state without a reload', () => {
    const other = { ...character, id: 'character_other', name: 'Other' };
    const saved = { ...character, voiceProfile: { ...character.voiceProfile, providerVoiceId: 'updated_voice' } };
    const updated = replaceSavedCharacter([character, other], saved);
    expect(updated[0]).toEqual(saved);
    expect(updated[1]).toBe(other);
  });

  it('returns a safe generic PATCH failure without exposing response details', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'provider credential or database detail' } }), { status: 500 }));
    const patch = buildVoiceProfilePatch(validDraft(), character.name);
    await expect(saveCharacterVoiceProfile('/api/series/series_1/characters/character_maya', patch, request)).rejects.toThrow('Unable to save voice profile.');
    await expect(saveCharacterVoiceProfile('/api/series/series_1/characters/character_maya', patch, request)).rejects.not.toThrow('credential');
  });

  it('wires safe loading states and does not auto-configure newly created characters', () => {
    const editorSource = readFileSync(path.join(process.cwd(), 'components/series/character-voice-profile-editor.tsx'), 'utf8');
    expect(editorSource).toContain('disabled={saving}');
    expect(editorSource).toContain('aria-busy={saving}');
    expect(editorSource).toContain("saving ? 'Saving…' : 'Save voice profile'");
    expect(editorSource).not.toMatch(/ELEVENLABS_API_KEY|NEXT_PUBLIC/);
    expect(editorSource).toContain('Google Cloud TTS — Chirp 3 HD (Recommended)');
    const managerSource = readFileSync(path.join(process.cwd(), 'components/series/production-data-manager.tsx'), 'utf8');
    expect(managerSource).toContain('<CharacterVoiceProfileEditor');
    expect(managerSource).toContain('setCharacters((current) => replaceSavedCharacter(current, saved))');
    expect(managerSource).toContain("voiceProfile: { tone: 'neutral', pace: 'normal' }");
    expect(managerSource).not.toContain("voiceProfile: { tone: 'neutral', pace: 'normal', provider:");
  });
});
