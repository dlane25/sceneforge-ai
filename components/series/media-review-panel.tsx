'use client';

import { useState } from 'react';
import { Check, Clock3, Crown, History, Play, RefreshCw, RotateCcw, ShieldCheck, Square, X } from 'lucide-react';

type Asset = {
  id: string; generationJobId: string; provider: string; providerModel?: string; providerJobId?: string;
  version: number; uri: string; mimeType: string; width: number; height: number; durationSeconds?: number;
  reviewStatus: 'pending' | 'approved' | 'rejected'; preferred?: boolean; createdAt: string; supersededAt?: string;
  costMetadata?: { estimatedCost: number; actualCost: number; currency?: string };
};
type Review = { id: string; status: string; notes?: string; rejectionReason?: string; continuityAssessment: string; reviewerActor: string; reviewedAt?: string; createdAt: string };
type Job = {
  id: string; status: string; provider: string; providerModel?: string; providerJobId?: string;
  estimatedCost: number; actualCost: number; createdAt: string; submittedAt?: string; lastPolledAt?: string;
  lastProviderStatus?: string; errorCode?: string; errorMessage?: string;
};
type Readiness = { ready: boolean; blockers: string[]; warnings: string[] };

function money(value: number | undefined): string { return value && value > 0 ? `$${value.toFixed(2)}` : 'not reported' }

export function MediaReviewPanel({ seriesId, episodeId, sceneId, shotId }: { seriesId: string; episodeId: string; sceneId: string; shotId: string }) {
  const base = `/api/series/${seriesId}/episodes/${episodeId}/scenes/${sceneId}/shots/${shotId}`;
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [comparison, setComparison] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    setBusy('load'); setError('');
    try {
      const [assetResponse, jobResponse, readinessResponse] = await Promise.all([fetch(`${base}/assets`), fetch(`${base}/generation`), fetch(`${base}/readiness`)]);
      if (!assetResponse.ok || !jobResponse.ok || !readinessResponse.ok) throw new Error('Unable to load media review data.');
      setAssets((await assetResponse.json()).data);
      setJobs((await jobResponse.json()).data);
      setReadiness((await readinessResponse.json()).data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load media review data.'); }
    finally { setBusy(''); }
  }

  async function prepareGeneration() {
    setBusy('prepare'); setError('');
    const response = await fetch(`${base}/generation`, { method: 'POST' });
    if (!response.ok) setError((await response.json()).error?.message || 'Unable to prepare generation.');
    await load();
  }

  async function jobAction(job: Job, name: 'approve' | 'reject' | 'start' | 'refresh' | 'cancel' | 'retry') {
    setBusy(`${job.id}:${name}`); setError('');
    const response = await fetch(`${base}/generation/${job.id}/${name}`, { method: 'POST' });
    if (!response.ok) setError((await response.json()).error?.message || `Unable to ${name} generation.`);
    await load();
  }

  async function assetAction(asset: Asset, name: 'approve' | 'reject' | 'preferred') {
    setBusy(`${asset.id}:${name}`); setError('');
    const payload = name === 'reject' ? { rejectionReason: 'Rejected during storyboard review.' } : { notes: 'Reviewed in storyboard workspace.' };
    const response = await fetch(`${base}/assets/${asset.id}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) setError((await response.json()).error?.message || 'Review action failed.');
    await load();
  }

  async function history(asset: Asset) {
    const response = await fetch(`${base}/assets/${asset.id}/reviews`);
    if (response.ok) { const payload = await response.json() as { data: Review[] }; setReviews((current) => ({ ...current, [asset.id]: payload.data })); }
    else setError('Unable to load review history.');
  }

  async function compare(asset: Asset) {
    const other = assets?.find((value) => value.id !== asset.id);
    if (!other) { setError('Create another version before comparing.'); return; }
    const response = await fetch(`${base}/assets/${asset.id}/compare`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ compareWith: other.id }) });
    if (response.ok) setComparison((await response.json()).data); else setError('Unable to compare versions.');
  }

  const hasActiveJob = jobs.some((job) => ['awaiting_approval', 'approved', 'queued', 'processing'].includes(job.status));

  return <section className="mt-4 border border-stone-800 bg-stone-900 p-4" aria-labelledby={`media-review-${shotId}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs uppercase tracking-[0.16em] text-amber-500">Media generation & review</p><h3 id={`media-review-${shotId}`} className="mt-1 text-base font-semibold">Provider-governed assets</h3></div>
      <div className="flex gap-2">
        <button type="button" onClick={prepareGeneration} disabled={!readiness?.ready || hasActiveJob || !!busy} className="inline-flex items-center gap-1 rounded bg-amber-700 px-3 py-1.5 text-xs disabled:opacity-40"><ShieldCheck size={13} /> Prepare</button>
        <button type="button" onClick={load} disabled={busy === 'load'} className="rounded border border-stone-700 px-3 py-1.5 text-xs text-stone-200 disabled:opacity-50">{busy === 'load' ? 'Loading...' : 'Load review'}</button>
      </div>
    </div>
    <p className="mt-2 text-xs text-stone-500">Provider and model are selected on the server and are read-only here. A human owner must approve the snapshotted prompt and estimated cost before submission.</p>
    {assets === null && <p className="mt-4 text-sm text-stone-500">Load provider state, generated assets, and review history for this shot.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    {readiness && <div className={`mt-4 border-l-2 pl-3 text-xs ${readiness.ready ? 'border-emerald-500 text-stone-400' : 'border-red-500 text-red-300'}`}><p>{readiness.ready ? 'Continuity readiness clear for generation and review.' : `Approval blocked: ${readiness.blockers.join(' ')}`}</p>{readiness.warnings.map((warning) => <p key={warning} className="mt-1 text-amber-300">Warning: {warning}</p>)}</div>}

    {jobs.map((job) => <article key={job.id} className="mt-4 border border-stone-800 bg-stone-950 p-4">
      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm font-semibold text-amber-300">{job.provider} · {job.providerModel || 'default model'}</p><p className="mt-1 text-xs text-stone-500">Status: {job.status}{job.lastProviderStatus ? ` · provider ${job.lastProviderStatus}` : ''}</p></div><span className="border border-stone-700 px-2 py-1 text-xs text-stone-300">estimated {money(job.estimatedCost)} · actual {money(job.actualCost)}</span></div>
      <dl className="mt-3 grid gap-1 text-xs text-stone-500 md:grid-cols-2"><div>Prepared: {new Date(job.createdAt).toLocaleString()}</div><div>Submitted: {job.submittedAt ? new Date(job.submittedAt).toLocaleString() : 'not submitted'}</div><div>Last refresh: {job.lastPolledAt ? new Date(job.lastPolledAt).toLocaleString() : 'not refreshed'}</div><div>Operation: {job.providerJobId || 'not assigned'}</div></dl>
      {job.errorCode && <p className="mt-3 text-xs text-red-300">{job.errorCode}: {job.errorMessage || 'Provider operation failed'}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {job.status === 'awaiting_approval' && <><button onClick={() => jobAction(job, 'approve')} disabled={!!busy} className="rounded bg-emerald-700 px-2 py-1.5 text-xs disabled:opacity-40">Approve cost & prompt</button><button onClick={() => jobAction(job, 'reject')} disabled={!!busy} className="rounded border border-red-800 px-2 py-1.5 text-xs text-red-300 disabled:opacity-40">Reject</button></>}
        {job.status === 'approved' && <button onClick={() => jobAction(job, 'start')} disabled={!!busy} className="inline-flex items-center gap-1 rounded bg-amber-700 px-2 py-1.5 text-xs disabled:opacity-40"><Play size={12} /> Submit</button>}
        {['queued', 'processing'].includes(job.status) && <button onClick={() => jobAction(job, 'refresh')} disabled={!!busy} className="inline-flex items-center gap-1 rounded border border-stone-700 px-2 py-1.5 text-xs disabled:opacity-40"><RefreshCw size={12} /> Refresh provider</button>}
        {['awaiting_approval', 'approved', 'queued', 'processing'].includes(job.status) && <button onClick={() => jobAction(job, 'cancel')} disabled={!!busy} className="inline-flex items-center gap-1 rounded border border-stone-700 px-2 py-1.5 text-xs disabled:opacity-40"><Square size={12} /> Cancel</button>}
        {['failed', 'cancelled'].includes(job.status) && <button onClick={() => jobAction(job, 'retry')} disabled={!!busy} className="inline-flex items-center gap-1 rounded border border-stone-700 px-2 py-1.5 text-xs disabled:opacity-40"><RotateCcw size={12} /> Retry with approval</button>}
      </div>
    </article>)}

    {assets?.length === 0 && <p className="mt-4 border border-dashed border-stone-700 p-5 text-sm text-stone-500">No generated assets yet. Prepare, approve, submit, and refresh a generation above.</p>}
    {assets?.map((asset) => <article key={asset.id} className="mt-4 border border-stone-800 bg-stone-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="font-semibold text-amber-300">Version {asset.version}</p>{asset.preferred && <span className="inline-flex items-center gap-1 bg-amber-900/40 px-2 py-1 text-[10px] text-amber-200"><Crown size={11} /> Preferred</span>}</div><p className="mt-1 text-xs text-stone-500">{asset.provider} · {asset.providerModel || 'default'} · {asset.durationSeconds || 0}s · {asset.width}x{asset.height}</p><p className="mt-1 text-xs text-stone-500">Job {asset.generationJobId} · {new Date(asset.createdAt).toLocaleString()} · actual {money(asset.costMetadata?.actualCost)}</p></div><span className="border border-stone-700 px-2 py-1 text-xs text-stone-300">{asset.reviewStatus}</span></div>
      <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden border border-dashed border-stone-700 bg-stone-900 text-xs text-stone-500">{asset.uri.startsWith('mock://') ? 'Mock media preview — metadata only' : <a href={asset.uri} target="_blank" rel="noreferrer" className="break-all p-4 text-amber-300">Open generated media</a>}</div>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!readiness?.ready || asset.reviewStatus !== 'pending' || !!busy} onClick={() => assetAction(asset, 'approve')} className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1.5 text-xs disabled:opacity-40"><Check size={13} /> Approve Asset</button><button type="button" disabled={asset.reviewStatus !== 'pending' || !!busy} onClick={() => assetAction(asset, 'reject')} className="inline-flex items-center gap-1 rounded border border-red-800 px-2 py-1.5 text-xs text-red-300 disabled:opacity-40"><X size={13} /> Reject Asset</button><button type="button" disabled={asset.reviewStatus !== 'approved' || asset.preferred || !!busy} onClick={() => assetAction(asset, 'preferred')} className="inline-flex items-center gap-1 rounded border border-amber-700 px-2 py-1.5 text-xs text-amber-200 disabled:opacity-40"><Crown size={13} /> Mark Preferred</button><button type="button" onClick={() => compare(asset)} className="rounded border border-stone-700 px-2 py-1.5 text-xs">Compare Versions</button><button type="button" onClick={() => history(asset)} className="inline-flex items-center gap-1 rounded border border-stone-700 px-2 py-1.5 text-xs"><History size={13} /> View History</button></div>
      {reviews[asset.id]?.map((review) => <div key={review.id} className="mt-3 border-l-2 border-stone-700 pl-3 text-xs text-stone-400"><p><Clock3 className="mr-1 inline" size={12} />{review.status} by {review.reviewerActor}</p>{review.notes && <p className="mt-1">{review.notes}</p>}{review.rejectionReason && <p className="mt-1 text-red-300">{review.rejectionReason}</p>}</div>)}
    </article>)}
    {comparison && <div role="dialog" aria-label="Asset version comparison" className="mt-4 border border-amber-800 bg-amber-950/20 p-4"><div className="flex justify-between"><h4 className="font-semibold text-amber-200">Version comparison</h4><button onClick={() => setComparison(null)} aria-label="Close comparison" className="text-stone-400">×</button></div><pre className="mt-3 overflow-auto text-xs text-stone-300">{JSON.stringify(comparison, null, 2)}</pre></div>}
  </section>;
}
