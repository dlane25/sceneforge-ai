import Link from 'next/link';
import { Plus, ShieldAlert } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { SeriesCard } from '@/components/series/series-card';
import { ensureDemoMembership, requireUser } from '@/lib/auth';
import { productionService } from '@/lib/series';

export const dynamic = 'force-dynamic';

export default async function SeriesPage() {
  const context = await requireUser();
  await ensureDemoMembership('series_empire_of_lies');
  const series = await productionService.listAccessibleSeries(context.user);

  return <MainLayout><div className="p-8">
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[0.2em] text-amber-500">Production library</p><h2 className="mt-2 text-4xl font-bold">Your productions</h2><p className="mt-2 text-stone-400">Only productions shared with your account appear here.</p></div>
      <Link href="/series/new" className="inline-flex items-center gap-2 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"><Plus size={16} /> New production</Link>
    </div>
    {series.length === 0 ? <div className="border border-dashed border-stone-700 p-12 text-center"><ShieldAlert className="mx-auto text-stone-500" /><p className="mt-4 text-stone-300">No productions are shared with you yet.</p></div> : <div className="grid gap-5 lg:grid-cols-2">{series.map((item) => <Link key={item.id} href={`/series/${item.id}`}><SeriesCard series={item} /></Link>)}</div>}
  </div></MainLayout>;
}
