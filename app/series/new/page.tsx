'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

const initialValues = { title: '', logline: '', genre: '', targetAudience: '', visualStyle: '', episodeCount: 60, episodeDurationSeconds: 75 };

export default function NewSeriesPage() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const response = await fetch('/api/series', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
    const payload = await response.json() as { data?: { id: string }; error?: { message: string } };
    if (payload.data) router.push(`/series/${payload.data.id}`); else setError(payload.error?.message || 'Unable to create production.');
    setSaving(false);
  }

  function update(key: keyof typeof values, value: string) { setValues((current) => ({ ...current, [key]: key === 'episodeCount' || key === 'episodeDurationSeconds' ? Number(value) : value })); }

  return <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100"><div className="mx-auto max-w-3xl"><Link href="/series" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-amber-300"><ArrowLeft size={16} /> Production library</Link><div className="mt-10 border-b border-stone-800 pb-6"><p className="text-xs uppercase tracking-[0.2em] text-amber-500">New production</p><h1 className="mt-2 text-4xl font-bold">Create a series</h1><p className="mt-3 text-stone-400">This production will be persisted and you will become its OWNER.</p></div><form onSubmit={submit} className="mt-8 space-y-5"><Field label="Series title" value={values.title} onChange={(value) => update('title', value)} placeholder="e.g. Empire of Lies" /><Field label="Logline" value={values.logline} onChange={(value) => update('logline', value)} placeholder="A concise premise with a turn" /><div className="grid gap-5 md:grid-cols-2"><Field label="Genre" value={values.genre} onChange={(value) => update('genre', value)} placeholder="Billionaire romance" /><Field label="Target audience" value={values.targetAudience} onChange={(value) => update('targetAudience', value)} placeholder="Adults 25-45" /></div><Field label="Visual style" value={values.visualStyle} onChange={(value) => update('visualStyle', value)} placeholder="Cinematic, moody, high contrast" /><div className="grid gap-5 md:grid-cols-2"><Field label="Episode count" type="number" value={String(values.episodeCount)} onChange={(value) => update('episodeCount', value)} placeholder="60" /><Field label="Duration in seconds" type="number" value={String(values.episodeDurationSeconds)} onChange={(value) => update('episodeDurationSeconds', value)} placeholder="75" /></div>{error && <p className="text-sm text-red-400">{error}</p>}<button disabled={saving} type="submit" className="inline-flex items-center gap-2 rounded bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"><Plus size={17} /> {saving ? 'Creating...' : 'Create draft'}</button></form></div></main>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <label className="block text-sm text-stone-300">{label}<input required name={label.toLowerCase().replaceAll(' ', '-')} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 block w-full border border-stone-700 bg-stone-900 px-3 py-3 text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-500" /></label>; }
