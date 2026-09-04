'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import {
  EMPIRE_OF_LIES_SERIES,
  EMPIRE_OF_LIES_CONTINUITY_FACTS,
  createEmpireOfLiesEpisodes,
} from '@/lib/mock';
import { ContinuityChecker } from '@/lib/memory/continuity-checker';

export default function SeriesDetailPage() {
  const series = EMPIRE_OF_LIES_SERIES;
  const episodes = createEmpireOfLiesEpisodes();
  const continuityFacts = EMPIRE_OF_LIES_CONTINUITY_FACTS;

  // Demonstrate continuity checker with intentional violation
  const checker = new ContinuityChecker();
  const violations = checker.checkShots(
    episodes[11]?.scenes?.[0]?.shots || [],
    12, // Episode 12 (where the violation should appear)
    1,
    continuityFacts
  );

  return (
    <MainLayout>
      <div className="p-8">
        <Link href="/" className="mb-6 text-amber-400 hover:text-amber-300">
          ← Back to Dashboard
        </Link>

        <div className="mb-12">
          <h2 className="text-4xl font-bold text-amber-400">{series.title}</h2>
          <p className="mt-2 text-lg text-stone-300">{series.logline}</p>
        </div>

        <div className="grid gap-6 grid-cols-3 mb-12">
          {/* Series Info */}
          <div className="rounded border border-stone-700 bg-stone-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-amber-400">Series Info</h3>
            <div className="space-y-2 text-sm text-stone-300">
              <p><span className="text-stone-400">Genre:</span> {series.genre}</p>
              <p><span className="text-stone-400">Audience:</span> {series.targetAudience}</p>
              <p><span className="text-stone-400">Episodes:</span> {series.episodeCount}</p>
              <p><span className="text-stone-400">Duration:</span> {series.episodeDurationSeconds}s</p>
              <p><span className="text-stone-400">Format:</span> Vertical 9:16</p>
              <p className="mt-3">
                <span className="inline-block rounded bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-300">
                  {series.status}
                </span>
              </p>
            </div>
          </div>

          {/* Visual Style */}
          <div className="rounded border border-stone-700 bg-stone-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-amber-400">Visual Style</h3>
            <p className="text-sm text-stone-300">{series.visualStyle}</p>
          </div>

          {/* Development Progress */}
          <div className="rounded border border-stone-700 bg-stone-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-amber-400">Development</h3>
            <div className="space-y-2 text-sm text-stone-300">
              <p><span className="text-stone-400">Characters:</span> {series.characters.length}</p>
              <p><span className="text-stone-400">Episodes Outlined:</span> {episodes.length}/60</p>
              <p className="mt-3 text-xs text-stone-400">
                Progress: {Math.round((episodes.length / 60) * 100)}%
              </p>
            </div>
          </div>
        </div>

        {/* Continuity Facts Display */}
        <section className="mb-12">
          <h3 className="mb-4 text-2xl font-semibold">Series Memory - Continuity Facts</h3>
          <div className="rounded border border-stone-700 bg-stone-900 p-6">
            <p className="mb-4 text-sm text-stone-400">
              Total active continuity facts: {continuityFacts.length}
            </p>
            <div className="space-y-3">
              {continuityFacts.map((fact) => (
                <div
                  key={fact.id}
                  className="rounded border border-stone-800 bg-stone-800/50 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-amber-300">{fact.key}</p>
                      <p className="mt-1 text-sm text-stone-300">{fact.value}</p>
                      <p className="mt-2 text-xs text-stone-500">
                        Valid from Ep {fact.validFromEpisode}
                        {fact.validToEpisode && ` - Ep ${fact.validToEpisode}`}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <span className="inline-block rounded bg-stone-700 px-2 py-1 text-xs text-stone-300">
                        {Math.round(fact.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Continuity Violations */}
        {violations.length > 0 && (
          <section className="mb-12">
            <h3 className="mb-4 text-2xl font-semibold">Continuity Violations Detected</h3>
            <div className="space-y-3">
              {violations.map((violation) => (
                <div
                  key={violation.id}
                  className={`rounded border p-4 ${
                    violation.severity === 'critical'
                      ? 'border-red-700 bg-red-900/30'
                      : violation.severity === 'high'
                        ? 'border-orange-700 bg-orange-900/30'
                        : 'border-yellow-700 bg-yellow-900/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">
                        Ep {violation.episodeNumber}, Scene {violation.sceneNumber}, Shot {violation.shotNumber}
                      </p>
                      <p className="mt-1 text-sm text-stone-300">{violation.description}</p>
                      {violation.suggestedFix && (
                        <p className="mt-2 text-xs text-stone-400">
                          Suggestion: {violation.suggestedFix}
                        </p>
                      )}
                    </div>
                    <span className={`ml-4 inline-block rounded px-2 py-1 text-xs font-medium ${
                      violation.severity === 'critical'
                        ? 'bg-red-700 text-white'
                        : violation.severity === 'high'
                          ? 'bg-orange-700 text-white'
                          : 'bg-yellow-700 text-white'
                    }`}>
                      {violation.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {violations.length === 0 && (
          <section className="mb-12">
            <div className="rounded border border-green-700 bg-green-900/30 p-6">
              <p className="text-sm text-green-300">✓ No continuity violations detected in demo episodes</p>
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
}
