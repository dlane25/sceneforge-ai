import Link from 'next/link';
import { ArrowLeft, Clapperboard, Film, ShieldCheck } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { ProductionPipeline } from '@/components/studio/production-pipeline';
import { createEmpireOfLiesEpisodes } from '@/lib/mock';
import { calculateDramaScores } from '@/lib/ai/drama-scorer';

export default async function EpisodeDetailPage({ params }: { params: Promise<{ episodeNumber: string }> }) {
  const { episodeNumber } = await params;
  const episode = createEmpireOfLiesEpisodes().find((item) => item.episodeNumber === Number(episodeNumber)) ?? createEmpireOfLiesEpisodes()[0];
  const score = calculateDramaScores(episode);

  return <MainLayout><div className="mx-auto max-w-5xl p-8">
    <Link href="/series/episodes" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-amber-300"><ArrowLeft size={16} /> All episodes</Link>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-800 pb-6">
      <div><p className="text-xs uppercase tracking-[0.2em] text-amber-500">Episode {episode.episodeNumber}</p><h2 className="mt-2 text-4xl font-bold">{episode.title}</h2></div>
      <span className="border border-amber-700/60 px-3 py-2 text-sm text-amber-300">Drama Score {score.overall}/100</span>
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="border border-stone-800 bg-stone-900 p-6"><h3 className="text-lg font-semibold text-amber-300">Story brief</h3><p className="mt-4 text-lg leading-8 text-stone-200">{episode.synopsis}</p><div className="mt-6 border-l-2 border-amber-600 pl-4"><p className="text-xs uppercase tracking-wide text-stone-500">Cliffhanger</p><p className="mt-2 text-stone-200">{episode.cliffhanger}</p></div></section>
      <section className="border border-stone-800 bg-stone-900 p-6"><h3 className="text-lg font-semibold">Score breakdown</h3><div className="mt-4 space-y-4">{[['Hook Strength', score.hookStrength], ['Conflict', score.conflict], ['Emotional Intensity', score.emotionalIntensity], ['Cliffhanger', score.cliffhanger], ['Character Continuity', score.characterContinuity]].map(([label, value]) => <div key={label as string}><div className="flex justify-between text-sm"><span className="text-stone-400">{label}</span><span>{value}</span></div><div className="mt-2 h-1 bg-stone-800"><div className="h-1 bg-amber-500" style={{ width: `${value}%` }} /></div></div>)}</div></section>
    </div>
    <section className="mt-6 border border-stone-800 bg-stone-900 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Storyboard</h3><span className="text-xs text-stone-500">No shots generated</span></div><div className="mt-5 grid gap-4 md:grid-cols-3"><Placeholder icon={<Clapperboard size={20} />} label="Shot list" /><Placeholder icon={<Film size={20} />} label="Vertical preview" /><Placeholder icon={<ShieldCheck size={20} />} label="Continuity review" /></div></section>
    <ProductionPipeline episodeId={episode.id} />
  </div></MainLayout>;
}

function Placeholder({ icon, label }: { icon: React.ReactNode; label: string }) { return <div className="flex aspect-[9/5] flex-col items-center justify-center border border-dashed border-stone-700 text-stone-500"><span className="text-amber-500">{icon}</span><span className="mt-2 text-sm">{label}</span></div>; }
