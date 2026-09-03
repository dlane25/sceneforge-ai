'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { SeriesCard } from '@/components/series/series-card';
import {
  EMPIRE_OF_LIES_SERIES,
  createEmpireOfLiesEpisodes,
} from '@/lib/mock';

export default function Home() {
  const episodes = createEmpireOfLiesEpisodes();
  const series = { ...EMPIRE_OF_LIES_SERIES, episodes };

  return (
    <MainLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-amber-400">Dashboard</h2>
          <p className="mt-2 text-stone-400">Welcome to SceneForge AI</p>
        </div>

        {/* Featured Series */}
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-2xl font-semibold">Featured Project</h3>
            <Link
              href="/series/new"
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition"
            >
              + Create Series
            </Link>
          </div>

          <SeriesCard series={series} />

          {/* Series Stats */}
          <div className="mt-6 grid gap-4 grid-cols-4">
            <div className="rounded border border-stone-700 bg-stone-900 p-4">
              <p className="text-xs text-stone-400">Total Episodes</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">{series.episodeCount}</p>
            </div>
            <div className="rounded border border-stone-700 bg-stone-900 p-4">
              <p className="text-xs text-stone-400">Developed</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">{episodes.length}</p>
            </div>
            <div className="rounded border border-stone-700 bg-stone-900 p-4">
              <p className="text-xs text-stone-400">Characters</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">{series.characters.length}</p>
            </div>
            <div className="rounded border border-stone-700 bg-stone-900 p-4">
              <p className="text-xs text-stone-400">Format</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">9:16</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-12">
          <h3 className="mb-4 text-2xl font-semibold">Quick Access</h3>
          <div className="grid gap-4 grid-cols-3">
            <Link
              href={`/series/${series.id}`}
              className="flex flex-col rounded border border-stone-700 bg-stone-900 p-4 hover:border-amber-400 hover:bg-stone-800 transition"
            >
              <p className="font-medium text-amber-400">Series Bible</p>
              <p className="mt-1 text-xs text-stone-400">View series details & continuity</p>
            </Link>
            <Link
              href={`/series/${series.id}/characters`}
              className="flex flex-col rounded border border-stone-700 bg-stone-900 p-4 hover:border-amber-400 hover:bg-stone-800 transition"
            >
              <p className="font-medium text-amber-400">Characters</p>
              <p className="mt-1 text-xs text-stone-400">Manage cast & character DNA</p>
            </Link>
            <Link
              href={`/series/${series.id}/episodes`}
              className="flex flex-col rounded border border-stone-700 bg-stone-900 p-4 hover:border-amber-400 hover:bg-stone-800 transition"
            >
              <p className="font-medium text-amber-400">Episodes</p>
              <p className="mt-1 text-xs text-stone-400">View & develop episodes</p>
            </Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
