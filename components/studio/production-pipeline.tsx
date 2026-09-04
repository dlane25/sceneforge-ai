'use client';

import { useState } from 'react';
import { Check, CircleAlert, Clock3, Play, ShieldCheck, Sparkles } from 'lucide-react';

type PipelineResult = {
  id: string;
  state: string;
  executions: Array<{ agent: string; status: string; explanation?: string; confidence?: number }>;
  continuity?: { findings: Array<{ severity: string; explanation: string }>; passed: boolean };
  scoring?: { overall: number; recommendations: string[] };
  approval?: { status: string; summary: string; projectedImpact: string };
  generationJobId?: string;
};

const stages = ['SHOWRUNNER', 'WRITER', 'DIRECTOR', 'CONTINUITY', 'DRAMA SCORE', 'APPROVAL', 'GENERATION'];

export function ProductionPipeline({ episodeId }: { episodeId: string }) {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function runPipeline() {
    setLoading(true); setMessage('');
    const response = await fetch('/api/series/series_empire_of_lies/orchestrate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ episodeId }) });
    const payload = await response.json() as { data?: PipelineResult; error?: { message: string } };
    if (payload.data) setResult(payload.data); else setMessage(payload.error?.message || 'Pipeline failed.');
    setLoading(false);
  }

  async function decide(action: 'approve' | 'reject') {
    if (!result) return;
    const response = await fetch(`/api/pipelines/${result.id}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: action === 'approve' ? 'Approved in Studio.' : 'Revision requested in Studio.' }) });
    const payload = await response.json() as { data?: PipelineResult; error?: { message: string } };
    if (payload.data) setResult(payload.data); else setMessage(payload.error?.message || 'Decision failed.');
  }

  return <section className="mt-8 border border-stone-800 bg-stone-900 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2 text-amber-400"><Sparkles size={18} /><p className="text-xs uppercase tracking-[0.2em]">AI production pipeline</p></div><h3 className="mt-2 text-2xl font-semibold">From outline to approval</h3><p className="mt-2 max-w-2xl text-sm text-stone-400">Deterministic agents draft, direct, review, and score this episode. No generation starts until a human approves.</p></div>
      <button type="button" onClick={runPipeline} disabled={loading} className="inline-flex items-center gap-2 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"><Play size={16} /> {loading ? 'Running...' : 'Run pipeline'}</button>
    </div>
    <div className="mt-8 grid gap-2 md:grid-cols-7">{stages.map((stage, index) => { const execution = result?.executions[index]; const isApproval = stage === 'APPROVAL'; const status = isApproval ? result?.approval?.status : execution?.status; return <div key={stage} className="border border-stone-800 p-3"><div className="flex items-center justify-between text-amber-400">{status === 'succeeded' || status === 'approved' ? <Check size={16} /> : status ? <CircleAlert size={16} /> : <Clock3 size={16} />}<span className="text-[10px] text-stone-500">{status || 'idle'}</span></div><p className="mt-3 text-xs font-medium text-stone-200">{stage}</p>{execution?.confidence && <p className="mt-1 text-[10px] text-stone-500">{Math.round(execution.confidence * 100)}% confidence</p>}</div>; })}</div>
    {result && <div className="mt-6 grid gap-5 lg:grid-cols-3"><div className="border-l-2 border-amber-500 pl-4 lg:col-span-2"><p className="text-xs uppercase tracking-wide text-stone-500">Audit summary</p><p className="mt-2 text-sm text-stone-200">{result.executions.map((item) => item.explanation).filter(Boolean).join(' ')}</p>{result.continuity && <p className="mt-3 text-sm text-stone-400">{result.continuity.findings.length ? `${result.continuity.findings.length} continuity warning(s) require review.` : 'Continuity passed.'}</p>}</div>{result.scoring && <div><p className="text-xs uppercase tracking-wide text-stone-500">Drama score</p><p className="mt-1 text-3xl font-semibold text-amber-400">{result.scoring.overall}<span className="text-base text-stone-500">/100</span></p><p className="mt-2 text-xs text-stone-400">{result.scoring.recommendations[0] || 'No immediate scoring recommendations.'}</p></div>}</div>}
    {result?.approval?.status === 'pending' && <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-amber-800/60 bg-amber-950/20 p-4"><div><p className="text-sm font-semibold text-amber-300">Human approval required</p><p className="mt-1 text-xs text-stone-400">{result.approval.summary} {result.approval.projectedImpact}</p></div><div className="flex gap-2"><button type="button" onClick={() => decide('reject')} className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-200 hover:border-red-500">Request Revision</button><button type="button" onClick={() => decide('approve')} className="inline-flex items-center gap-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500"><ShieldCheck size={14} /> Approve for Generation</button></div></div>}
    {result?.generationJobId && <p className="mt-4 text-xs text-emerald-400">Mock generation queued: {result.generationJobId}</p>}
    {message && <p className="mt-4 text-sm text-red-400">{message}</p>}
  </section>;
}
