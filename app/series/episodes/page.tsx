'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { EpisodeCard } from '@/components/episodes/episode-card';
import {
  EMPIRE_OF_LIES_SERIES,
  createEmpireOfLiesEpisodes,
} from '@/lib/mock';

export default function EpisodesPage() {
  const episodes = createEmpireOfLiesEpisodes();

  return (
    <MainLayout>
      <div className="p-8">
        <Link href="/" className="mb-6 text-amber-400 hover:text-amber-300">
          ← Back to Dashboard
        </Link>

        <div className="mb-8">
          <h2 className="text-4xl font-bold text-amber-400">
            {EMPIRE_OF_LIES_SERIES.title}
          </h2>
          <p className="mt-2 text-stone-400">Episodes</p>
        </div>

        <div className="grid gap-4 grid-cols-1">
          {episodes.map((episode) => (
            <EpisodeCard key={episode.id} episode={episode} />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
