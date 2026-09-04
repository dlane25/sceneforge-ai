'use client';

import type { Episode } from '@/types';

export function EpisodeCard({ episode }: { episode: Episode }) {
  return (
    <div className="rounded border border-stone-700 bg-stone-900 p-4 hover:border-amber-400 hover:bg-stone-800 transition">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-amber-400">Ep {episode.episodeNumber}: {episode.title}</h4>
          <p className="mt-1 text-xs text-stone-400">{episode.hook}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-stone-300 line-clamp-2">{episode.synopsis}</p>
      <div className="mt-3">
        <p className="text-xs text-stone-400">
          Cliffhanger: <span className="text-stone-300">{episode.cliffhanger}</span>
        </p>
      </div>
      {episode.dramaScore && (
        <div className="mt-3">
          <p className="text-xs font-medium text-amber-300">
            Drama Score: <span className="text-white">{episode.dramaScore.overall}/100</span>
          </p>
        </div>
      )}
    </div>
  );
}
