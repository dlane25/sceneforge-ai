import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  requestStoryboardPreparation,
  retainPreparedStoryboard,
  StoryboardPreparationStatus,
  StoryboardPrepareButton,
  STORYBOARD_PREPARE_ERROR,
  STORYBOARD_PREPARE_SUCCESS,
  type PreparedStoryboard,
  type PreparedStoryboards,
} from '@/components/series/storyboard-preparation';
import {
  buildShotDialoguePatch,
  initialShotDialogueDraft,
  replaceSavedShot,
  saveShotDialogue,
  ShotDialogueEditor,
  SHOT_DIALOGUE_MAX_LENGTH,
  type ShotDialogueCharacter,
} from '@/components/series/shot-dialogue-editor';

const storyboard: PreparedStoryboard = {
  id: 'storyboard_shot_1',
  shotId: 'shot_1',
  generationStatus: 'placeholder',
  aspectRatio: '9:16',
  provider: 'mock',
};

function successResponse(): Response {
  return new Response(JSON.stringify({ data: storyboard }), { status: 201, headers: { 'content-type': 'application/json' } });
}

describe('storyboard preparation UX', () => {
  it('retains the returned storyboard by shot and renders the successful 201 state', async () => {
    let storyboards: PreparedStoryboards = {};
    let notice = '';
    await requestStoryboardPreparation({
      shotId: storyboard.shotId,
      url: '/storyboard',
      inFlight: new Set(),
      request: vi.fn().mockResolvedValue(successResponse()),
      onLoading: () => undefined,
      onSuccess: (value) => {
        storyboards = retainPreparedStoryboard(storyboards, storyboard.shotId, value);
        notice = STORYBOARD_PREPARE_SUCCESS;
      },
      onFailure: () => { notice = STORYBOARD_PREPARE_ERROR; },
    });

    expect(storyboards[storyboard.shotId]).toEqual(storyboard);
    expect(notice).toBe('Storyboard placeholder prepared.');
    const status = renderToStaticMarkup(createElement(StoryboardPreparationStatus, { storyboard: storyboards[storyboard.shotId] }));
    expect(status).toContain('Frame prepared');
    expect(status).toContain('placeholder');
    expect(status).toContain('9:16');
    expect(status).toContain('mock');
    const button = renderToStaticMarkup(createElement(StoryboardPrepareButton, { loading: false, prepared: true, onPrepare: () => undefined }));
    expect(button).toContain('Refresh frame');
  });

  it('disables the per-shot button while the request is in flight', () => {
    const button = renderToStaticMarkup(createElement(StoryboardPrepareButton, { loading: true, prepared: false, onPrepare: () => undefined }));
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-busy="true"');
    expect(button).toContain('Preparing frame');
  });

  it('prevents rapid duplicate concurrent requests for the same shot', async () => {
    let resolveResponse!: (response: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => { resolveResponse = resolve; });
    const request = vi.fn().mockReturnValue(pendingResponse);
    const loadingStates: boolean[] = [];
    const inFlight = new Set<string>();
    const options = {
      shotId: storyboard.shotId,
      url: '/storyboard',
      inFlight,
      request,
      onLoading: (loading: boolean) => loadingStates.push(loading),
      onSuccess: () => undefined,
      onFailure: () => undefined,
    };

    const first = requestStoryboardPreparation(options);
    const duplicate = requestStoryboardPreparation(options);
    expect(request).toHaveBeenCalledOnce();
    expect(loadingStates).toEqual([true]);
    await expect(duplicate).resolves.toBe(false);
    resolveResponse(successResponse());
    await expect(first).resolves.toBe(true);
    expect(loadingStates).toEqual([true, false]);
    expect(inFlight.size).toBe(0);
  });

  it('preserves the generic failure notice', async () => {
    let notice = '';
    const succeeded = await requestStoryboardPreparation({
      shotId: storyboard.shotId,
      url: '/storyboard',
      inFlight: new Set(),
      request: vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'internal detail' } }), { status: 500 })),
      onLoading: () => undefined,
      onSuccess: () => { notice = STORYBOARD_PREPARE_SUCCESS; },
      onFailure: () => { notice = STORYBOARD_PREPARE_ERROR; },
    });
    expect(succeeded).toBe(false);
    expect(notice).toBe('Unable to prepare storyboard.');
    expect(notice).not.toContain('internal detail');
  });

  it('wires per-shot client state, loading, and prepared rendering into StoryboardManager', () => {
    const source = readFileSync(path.join(process.cwd(), 'components/series/storyboard-manager.tsx'), 'utf8');
    expect(source).toContain('setStoryboards((current) => retainPreparedStoryboard(current, shotId, storyboard))');
    expect(source).toContain('loading={Boolean(preparingShots[shot.id])}');
    expect(source).toContain('prepared={Boolean(storyboards[shot.id])}');
    expect(source).toContain('<StoryboardPreparationStatus storyboard={storyboards[shot.id]} />');
  });
});

const characters: ShotDialogueCharacter[] = [
  { id: 'character_1', name: 'Mara' },
  { id: 'character_2', name: 'Jonah' },
];

describe('shot dialogue editing UX', () => {
  it('loads persisted characters into the editor and initializes persisted speaker and dialogue', () => {
    const shot = { id: 'shot_1', characterIds: ['character_2'], dialogue: '  We leave at dawn.  ' };
    expect(initialShotDialogueDraft(shot, characters)).toEqual({ characterIds: ['character_2'], dialogue: '  We leave at dawn.  ' });

    const markup = renderToStaticMarkup(createElement(ShotDialogueEditor, {
      shot,
      characters,
      endpoint: '/api/shot_1',
      onSaved: () => undefined,
    }));
    expect(markup).toContain('Mara');
    expect(markup).toContain('Jonah');
    expect(markup).toContain('value="character_2" selected=""');
    expect(markup).toContain('We leave at dawn.');
    expect(markup).toContain('used as the dialogue speaker');
  });

  it('sends only the intended trimmed dialogue and selected speaker fields in PATCH', async () => {
    const patch = buildShotDialoguePatch('  Hold the line.  ', 'character_1', characters);
    const saved = { id: 'shot_1', ...patch };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: saved }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(saveShotDialogue('/api/shot_1', patch, request)).resolves.toEqual(saved);
    expect(request).toHaveBeenCalledWith('/api/shot_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dialogue: 'Hold the line.', characterIds: ['character_1'] }),
    });
  });

  it('updates the local shot collection with the persisted response for immediate audio-panel input', () => {
    const current = [
      { id: 'shot_1', shotNumber: 1, description: 'Wide shot', characterIds: [], dialogue: '' },
      { id: 'shot_2', shotNumber: 2, description: 'Close shot', characterIds: [], dialogue: '' },
    ];
    const updated = replaceSavedShot(current, { id: 'shot_1', characterIds: ['character_1'], dialogue: 'Ready.' });
    expect(updated[0]).toEqual({ ...current[0], characterIds: ['character_1'], dialogue: 'Ready.' });
    expect(updated[1]).toBe(current[1]);

    const source = readFileSync(path.join(process.cwd(), 'components/series/storyboard-manager.tsx'), 'utf8');
    expect(source).toContain('setShots((current) => replaceSavedShot(current, saved))');
    expect(source).toContain('<AudioCaptionPanel seriesId={seriesId} episodeId={episodeId} sceneId={sceneId} shots={shots} />');
  });

  it('handles empty values safely and never invents a speaker', () => {
    expect(buildShotDialoguePatch('   ', '', characters)).toEqual({ dialogue: '', characterIds: [] });
    expect(initialShotDialogueDraft({ id: 'shot_1', characterIds: [], dialogue: undefined }, characters)).toEqual({ dialogue: '', characterIds: [] });
  });

  it('rejects stale character IDs instead of newly submitting them', () => {
    expect(() => buildShotDialoguePatch('Hello.', 'character_deleted', characters)).toThrow('no longer available');
    expect(initialShotDialogueDraft({ id: 'shot_1', characterIds: ['character_deleted'], dialogue: 'Old line.' }, characters).characterIds).toEqual([]);
  });

  it('constrains dialogue to the existing 2000-character API limit', () => {
    expect(buildShotDialoguePatch('x'.repeat(SHOT_DIALOGUE_MAX_LENGTH), 'character_1', characters).dialogue).toHaveLength(2000);
    expect(() => buildShotDialoguePatch('x'.repeat(SHOT_DIALOGUE_MAX_LENGTH + 1), 'character_1', characters)).toThrow('2000 characters or fewer');
    const markup = renderToStaticMarkup(createElement(ShotDialogueEditor, {
      shot: { id: 'shot_1', characterIds: [], dialogue: '' },
      characters,
      endpoint: '/api/shot_1',
      onSaved: () => undefined,
    }));
    expect(markup).toContain('maxLength="2000"');
  });

  it('uses the existing authenticated character API and preserves editor loading state', () => {
    const source = readFileSync(path.join(process.cwd(), 'components/series/storyboard-manager.tsx'), 'utf8');
    expect(source).toContain('fetch(`/api/series/${seriesId}/characters`)');
    expect(source).toContain('Loading production characters');
    expect(source).toContain('<ShotDialogueEditor');
    const editorSource = readFileSync(path.join(process.cwd(), 'components/series/shot-dialogue-editor.tsx'), 'utf8');
    expect(editorSource).toContain('disabled={saving}');
    expect(editorSource).toContain("saving ? 'Saving…' : 'Save dialogue'");
  });
});
