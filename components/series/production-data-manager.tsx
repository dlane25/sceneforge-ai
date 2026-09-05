'use client';

import { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';

type RecordItem = { id: string; name?: string; title?: string; episodeNumber?: number; description?: string; sceneNumber?: number };

export function ProductionDataManager({ seriesId }: { seriesId: string }) {
  const [characters, setCharacters] = useState<RecordItem[]>([]);
  const [locations, setLocations] = useState<RecordItem[]>([]);
  const [episodes, setEpisodes] = useState<RecordItem[]>([]);
  const [facts, setFacts] = useState<RecordItem[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState('');
  const [notice, setNotice] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');

  async function refresh() {
    const [characterResponse, locationResponse, episodeResponse, factResponse] = await Promise.all([fetch(`/api/series/${seriesId}/characters`), fetch(`/api/series/${seriesId}/locations`), fetch(`/api/series/${seriesId}/episodes`), fetch(`/api/series/${seriesId}/continuity`)]);
    setCharacters((await characterResponse.json()).data || []); setLocations((await locationResponse.json()).data || []); const nextEpisodes = (await episodeResponse.json()).data || []; setEpisodes(nextEpisodes); setFacts((await factResponse.json()).data || []); if (!selectedEpisode && nextEpisodes[0]) setSelectedEpisode(nextEpisodes[0].id);
  }
  // Load the selected production's structured data after the client mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void refresh(); }, [seriesId]);
  async function create(path: string, body: unknown) { const response = await fetch(`/api/series/${seriesId}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); setNotice(response.ok ? 'Saved.' : 'Unable to save.'); if (response.ok) { await refresh(); } }
  async function createScene() { if (!selectedEpisode) return; const response = await fetch(`/api/series/${seriesId}/episodes/${selectedEpisode}/scenes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sceneNumber: 1, title: 'Opening beat', description: 'A new production scene.' }) }); setNotice(response.ok ? 'Scene saved.' : 'Unable to save scene.'); }

  return <div className="mt-8 grid gap-6 lg:grid-cols-2"><DataPanel title="Characters" value={characterName} setValue={setCharacterName} placeholder="Character name" action={() => create('characters', { name: characterName, role: 'supporting', age: 30, appearance: 'Production character', personality: 'Defined in the series bible', wardrobe: 'To be designed', voiceProfile: { tone: 'neutral', pace: 'normal' } })} items={characters} primary="name" /><DataPanel title="Locations" value={locationName} setValue={setLocationName} placeholder="Location name" action={() => create('locations', { name: locationName, description: 'Production location' })} items={locations} primary="name" /><DataPanel title="Episodes" value={episodeTitle} setValue={setEpisodeTitle} placeholder="Episode title" action={() => create('episodes', { episodeNumber: episodes.length + 1, title: episodeTitle, synopsis: 'Episode synopsis' })} items={episodes} primary="title" /><section className="border border-stone-800 bg-stone-900 p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Scenes and Series Memory</h3><button onClick={createScene} className="inline-flex items-center gap-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold"><Plus size={14} /> Add scene</button></div><select value={selectedEpisode} onChange={(event) => setSelectedEpisode(event.target.value)} className="mt-4 w-full border border-stone-700 bg-stone-950 px-3 py-2 text-sm"><option value="">Select episode</option>{episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.episodeNumber}: {episode.title}</option>)}</select><div className="mt-4 space-y-2">{facts.map((fact) => <div key={fact.id} className="border-b border-stone-800 py-2 text-sm text-stone-300">{fact.description || fact.name}<span className="ml-2 text-xs text-stone-500">Series Memory</span></div>)}{!facts.length && <p className="text-sm text-stone-500">No story facts recorded yet.</p>}</div>{notice && <p className="mt-4 text-sm text-amber-300">{notice}</p>}</section></div>;
}

function DataPanel({ title, value, setValue, placeholder, action, items, primary }: { title: string; value: string; setValue: (value: string) => void; placeholder: string; action: () => void; items: RecordItem[]; primary: 'name' | 'title' }) { return <section className="border border-stone-800 bg-stone-900 p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><span className="text-xs text-stone-500">{items.length} records</span></div><div className="mt-4 flex gap-2"><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 border border-stone-700 bg-stone-950 px-3 py-2 text-sm" /><button onClick={action} className="rounded bg-amber-600 p-2" aria-label={`Create ${title}`}><Plus size={16} /></button></div><div className="mt-4 space-y-2">{items.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-stone-800 py-2 text-sm text-stone-300"><span>{item[primary] || item.description}</span><span className="text-xs text-stone-600"><Save size={13} /></span></div>)}{!items.length && <p className="text-sm text-stone-500">No records yet.</p>}</div></section>; }
