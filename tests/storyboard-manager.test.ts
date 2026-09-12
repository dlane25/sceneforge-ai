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
