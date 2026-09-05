import Link from 'next/link';
import { ArrowLeft, Database } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { ProductionDataManager } from '@/components/series/production-data-manager';
import { StoryboardManager } from '@/components/series/storyboard-manager';
import { requireUser } from '@/lib/auth';
import { productionService } from '@/lib/series';

export const dynamic = 'force-dynamic';

export default async function ProductionDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser();
  const series = await productionService.getSeries(user, (await params).id);
  return <MainLayout><div className="p-8"><Link href={`/series/${series.id}`} className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-amber-300"><ArrowLeft size={16} /> {series.title}</Link><div className="mt-8 border-b border-stone-800 pb-6"><div className="flex items-center gap-3 text-amber-400"><Database size={19} /><p className="text-xs uppercase tracking-[0.2em]">Production data</p></div><h1 className="mt-2 text-4xl font-bold">{series.title} workspace</h1><p className="mt-3 text-stone-400">Characters, locations, episodes, scenes, shots, and Series Memory for this production.</p></div><ProductionDataManager seriesId={series.id} /><StoryboardManager seriesId={series.id} /></div></MainLayout>;
}