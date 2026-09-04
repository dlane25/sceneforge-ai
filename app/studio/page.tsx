import Link from 'next/link';
import { AlertTriangle, Film, Gauge, Layers3, MemoryStick } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { EMPIRE_OF_LIES_CONTINUITY_FACTS, EMPIRE_OF_LIES_SERIES, createEmpireOfLiesEpisodes } from '@/lib/mock';
import { calculateBatchDramaScores } from '@/lib/ai/drama-scorer';

export default function StudioPage() {
  const episodes = createEmpireOfLiesEpisodes();
  const scores = calculateBatchDramaScores(episodes);

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-500">Production command center</p>
            <h2 className="mt-2 text-4xl font-bold text-stone-100">{EMPIRE_OF_LIES_SERIES.title}</h2>
          </div>
          <Link href="/series" className="rounded border border-stone-700 px-4 py-2 text-sm text-stone-200 hover:border-amber-400">
            Open Series Bible
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StudioMetric icon={<Film size={18} />} label="Episodes developed" value={`${episodes.length} / 60`} />
          <StudioMetric icon={<Gauge size={18} />} label="Average drama score" value={`${Math.round(Array.from(scores.values()).reduce((sum, score) => sum + score.overall, 0) / scores.size)} / 100`} />
          <StudioMetric icon={<MemoryStick size={18} />} label="Memory facts" value={`${EMPIRE_OF_LIES_CONTINUITY_FACTS.length}`} />
          <StudioMetric icon={<AlertTriangle size={18} />} label="Continuity review" value="1 flagged" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="border border-stone-800 bg-stone-900 p-6">
            <div className="flex items-center gap-3">
              <Layers3 className="text-amber-400" size={20} />
              <h3 className="text-xl font-semibold">Storyboard queue</h3>
            </div>
            <div className="mt-5 space-y-3">
              {episodes.slice(0, 3).map((episode) => (
                <Link key={episode.id} href={`/series/episodes/${episode.episodeNumber}`} className="flex items-center justify-between border-b border-stone-800 py-3 hover:text-amber-300">
                  <span><span className="mr-3 text-xs text-stone-500">EP {String(episode.episodeNumber).padStart(2, '0')}</span>{episode.title}</span>
                  <span className="text-xs text-amber-400">{scores.get(episode.id)?.overall}/100</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="border border-stone-800 bg-stone-900 p-6">
            <h3 className="text-xl font-semibold">Generation jobs</h3>
            <div className="mt-5 flex items-center justify-between border-b border-stone-800 py-3 text-sm">
              <span className="text-stone-400">Mock provider</span><span className="text-amber-400">Ready</span>
            </div>
            <div className="flex items-center justify-between border-b border-stone-800 py-3 text-sm">
              <span className="text-stone-400">Queued shots</span><span>0</span>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <span className="text-stone-400">Estimated spend</span><span>$0.00</span>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}

function StudioMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-stone-800 bg-stone-900 p-5">
      <div className="flex items-center gap-2 text-amber-400">{icon}<span className="text-xs uppercase tracking-wide text-stone-400">{label}</span></div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}
