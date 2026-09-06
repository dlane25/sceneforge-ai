'use client';

import { useEffect, useState } from 'react';
import { Clapperboard, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { MediaReviewPanel } from './media-review-panel';

type Episode = { id: string; episodeNumber: number; title: string };
type Scene = { id: string; sceneNumber: number; title: string };
type Shot = { id: string; shotNumber: number; title?: string; description: string; visualPrompt?: string; status?: string };
type Readiness = { ready: boolean; blockers: string[]; warnings: string[] };

export function StoryboardManager({ seriesId }: { seriesId: string }) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [episodeId, setEpisodeId] = useState('');
  const [sceneId, setSceneId] = useState('');
  const [readiness, setReadiness] = useState<Record<string, Readiness>>({});
  const [notice, setNotice] = useState('');

  async function loadEpisodes() { const response = await fetch(`/api/series/${seriesId}/episodes`); const data = (await response.json()).data || []; setEpisodes(data); if (!episodeId && data[0]) setEpisodeId(data[0].id); }
  async function loadScenes(nextEpisodeId = episodeId) { if (!nextEpisodeId) return; const response = await fetch(`/api/series/${seriesId}/episodes/${nextEpisodeId}/scenes`); const data = (await response.json()).data || []; setScenes(data); setSceneId(data[0]?.id || ''); }
  async function loadShots(nextSceneId = sceneId) { if (!episodeId || !nextSceneId) return; const response = await fetch(`/api/series/${seriesId}/episodes/${episodeId}/scenes/${nextSceneId}/shots`); setShots((await response.json()).data || []); }
  // These effects synchronize remote production data with the selected workspace context.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void loadEpisodes(); }, [seriesId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void loadScenes(); }, [episodeId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void loadShots(); }, [sceneId]);
  async function createShot() { const response = await fetch(`/api/series/${seriesId}/episodes/${episodeId}/scenes/${sceneId}/shots`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shotNumber: shots.length + 1, title: `Shot ${shots.length + 1}`, description: 'New production shot.', durationSeconds: 4, framing: 'medium', cameraMovement: 'static', visualPrompt: 'Cinematic vertical 9:16 production shot.' }) }); setNotice(response.ok ? 'Shot created.' : 'Unable to create shot.'); await loadShots(); }
  async function removeShot(shotId: string) { await fetch(`/api/series/${seriesId}/episodes/${episodeId}/scenes/${sceneId}/shots/${shotId}`, { method: 'DELETE' }); await loadShots(); }
  async function prepareStoryboard(shotId: string) { const response = await fetch(`/api/series/${seriesId}/episodes/${episodeId}/scenes/${sceneId}/shots/${shotId}/storyboard`, { method: 'POST' }); setNotice(response.ok ? 'Storyboard placeholder prepared.' : 'Unable to prepare storyboard.'); }
  async function checkReadiness(shotId: string) { const response = await fetch(`/api/series/${seriesId}/episodes/${episodeId}/scenes/${sceneId}/shots/${shotId}/readiness`); const data = (await response.json()).data; setReadiness((current) => ({ ...current, [shotId]: data })); }

  return <section className="mt-8 border border-stone-800 bg-stone-900 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-amber-400"><Clapperboard size={18} /><p className="text-xs uppercase tracking-[0.2em]">Storyboard production</p></div><h2 className="mt-2 text-2xl font-semibold">Shot planning</h2></div><button onClick={createShot} disabled={!sceneId} className="inline-flex items-center gap-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold disabled:opacity-40"><Plus size={14} /> Add shot</button></div><div className="mt-5 grid gap-3 md:grid-cols-2"><select value={episodeId} onChange={(event) => setEpisodeId(event.target.value)} className="border border-stone-700 bg-stone-950 px-3 py-2 text-sm"><option value="">Select episode</option>{episodes.map((episode) => <option key={episode.id} value={episode.id}>Episode {episode.episodeNumber}: {episode.title}</option>)}</select><select value={sceneId} onChange={(event) => setSceneId(event.target.value)} className="border border-stone-700 bg-stone-950 px-3 py-2 text-sm"><option value="">Select scene</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>Scene {scene.sceneNumber}: {scene.title}</option>)}</select></div><div className="mt-5 space-y-3">{shots.map((shot) => <div key={shot.id} className="border border-stone-800 bg-stone-950 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-amber-300">{shot.shotNumber}. {shot.title || 'Untitled shot'}</p><p className="mt-1 text-sm text-stone-300">{shot.description}</p><p className="mt-2 text-xs text-stone-500">{shot.status || 'draft'} · {shot.visualPrompt || 'No prompt'}</p></div><button onClick={() => removeShot(shot.id)} className="text-stone-500 hover:text-red-400" aria-label="Delete shot"><Trash2 size={15} /></button></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => prepareStoryboard(shot.id)} className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-300">Prepare frame</button><button onClick={() => checkReadiness(shot.id)} className="inline-flex items-center gap-1 rounded border border-stone-700 px-2 py-1 text-xs text-stone-300"><ShieldCheck size={13} /> Readiness</button></div>{readiness[shot.id] && <div className={`mt-3 text-xs ${readiness[shot.id].ready ? 'text-emerald-400' : 'text-red-400'}`}>{readiness[shot.id].ready ? 'Ready for provider handoff.' : readiness[shot.id].blockers.join(' ') }{readiness[shot.id].warnings.length > 0 && <span className="ml-2 text-amber-300">{readiness[shot.id].warnings.join(' ')}</span>}</div>}<MediaReviewPanel seriesId={seriesId} episodeId={episodeId} sceneId={sceneId} shotId={shot.id} /></div>)}{!shots.length && <div className="border border-dashed border-stone-700 p-8 text-center text-sm text-stone-500">Select a scene or add the first shot.</div>}</div>{notice && <p className="mt-4 text-sm text-amber-300">{notice}</p>}<button onClick={() => { void loadShots(); }} className="mt-4 inline-flex items-center gap-2 text-xs text-stone-500 hover:text-amber-300"><RefreshCw size={13} /> Refresh shots</button></section>;
}
