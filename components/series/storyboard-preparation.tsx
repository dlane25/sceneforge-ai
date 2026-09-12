export interface PreparedStoryboard {
  id: string;
  shotId: string;
  generationStatus: string;
  aspectRatio: string;
  provider?: string;
}

export type PreparedStoryboards = Record<string, PreparedStoryboard>;
type StoryboardResponse = Pick<Response, 'ok' | 'json'>;
type StoryboardRequest = (url: string, init: RequestInit) => Promise<StoryboardResponse>;

export const STORYBOARD_PREPARE_SUCCESS = 'Storyboard placeholder prepared.';
export const STORYBOARD_PREPARE_ERROR = 'Unable to prepare storyboard.';

export function retainPreparedStoryboard(current: PreparedStoryboards, shotId: string, storyboard: PreparedStoryboard): PreparedStoryboards {
  return { ...current, [shotId]: storyboard };
}

export async function requestStoryboardPreparation({
  shotId,
  url,
  inFlight,
  request,
  onLoading,
  onSuccess,
  onFailure,
}: {
  shotId: string;
  url: string;
  inFlight: Set<string>;
  request: StoryboardRequest;
  onLoading: (loading: boolean) => void;
  onSuccess: (storyboard: PreparedStoryboard) => void;
  onFailure: () => void;
}): Promise<boolean> {
  if (inFlight.has(shotId)) return false;

  inFlight.add(shotId);
  onLoading(true);
  try {
    const response = await request(url, { method: 'POST' });
    if (!response.ok) {
      onFailure();
      return false;
    }
    const payload = await response.json() as { data?: PreparedStoryboard };
    if (!payload.data) {
      onFailure();
      return false;
    }
    onSuccess(payload.data);
    return true;
  } catch {
    onFailure();
    return false;
  } finally {
    inFlight.delete(shotId);
    onLoading(false);
  }
}

export function StoryboardPrepareButton({ loading, prepared, onPrepare }: { loading: boolean; prepared: boolean; onPrepare: () => void }) {
  return <button disabled={loading} aria-busy={loading} onClick={onPrepare} className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 disabled:cursor-not-allowed disabled:opacity-50">
    {loading ? 'Preparing frame…' : prepared ? 'Refresh frame' : 'Prepare frame'}
  </button>;
}

export function StoryboardPreparationStatus({ storyboard }: { storyboard?: PreparedStoryboard }) {
  if (!storyboard) return null;
  return <div className="mt-3 rounded border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
    <p className="font-semibold">Frame prepared</p>
    <p className="mt-1 text-emerald-400/80">{storyboard.generationStatus} · {storyboard.aspectRatio}{storyboard.provider ? ` · ${storyboard.provider}` : ''}</p>
  </div>;
}
