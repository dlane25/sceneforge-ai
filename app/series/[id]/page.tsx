import Link from 'next/link';
import { ArrowLeft, BookOpen, Database } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { ProductionSettings } from '@/components/series/production-settings';
import { requireUser } from '@/lib/auth';
import { productionService } from '@/lib/series';
import { canApprovePipeline } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser();
  const series = await productionService.getSeries(user, (await params).id);
  const canManageMembers = await canApprovePipeline(user.id, series.id);

  return <MainLayout><div className="p-8"><Link href="/series" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-amber-300"><ArrowLeft size={16} /> Production library</Link><div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-800 pb-6"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-500">Production</p><h1 className="mt-2 text-4xl font-bold text-amber-400">{series.title}</h1><p className="mt-3 max-w-3xl text-stone-300">{series.logline}</p></div><div className="flex gap-2"><Link href={`/series/${series.id}/data`} className="inline-flex items-center gap-2 border border-stone-700 px-3 py-2 text-sm"><Database size={15} /> Production data</Link><Link href={`/series/${series.id}/episodes`} className="inline-flex items-center gap-2 border border-stone-700 px-3 py-2 text-sm"><BookOpen size={15} /> Episodes</Link></div></div><ProductionSettings series={series} canManageMembers={canManageMembers} /></div></MainLayout>;
}
