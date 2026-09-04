'use client';

import type { Series } from '@/types';

export function SeriesCard({ series }: { series: Series }) {
  return (
    <div className="rounded border border-stone-700 bg-stone-900 p-6 hover:border-amber-400 hover:bg-stone-800 transition">
      <h3 className="text-lg font-semibold text-amber-400">{series.title}</h3>
      <p className="mt-2 text-sm text-stone-300">{series.logline}</p>
      <div className="mt-4 space-y-1 text-xs text-stone-400">
        <p>Genre: {series.genre}</p>
        <p>Episodes: {series.episodeCount}</p>
        <p>Duration: {series.episodeDurationSeconds}s each</p>
        <p>Format: Vertical 9:16</p>
      </div>
      <div className="mt-4">
        <span className="inline-block rounded bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-300">
          {series.status}
        </span>
      </div>
    </div>
  );
}
