import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';

export default function NewSeriesPage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-amber-300"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="mt-10 border-b border-stone-800 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-500">New production</p>
          <h2 className="mt-2 text-4xl font-bold">Create a series</h2>
          <p className="mt-3 text-stone-400">Set the creative brief. Generation stays deterministic until you choose a provider.</p>
        </div>
        <form className="mt-8 space-y-5" action="/series">
          <Field label="Series title" placeholder="e.g. Empire of Lies" />
          <Field label="Logline" placeholder="A concise premise with a turn" />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Genre" placeholder="Billionaire romance" />
            <Field label="Target audience" placeholder="Adults 25-45" />
          </div>
          <Field label="Visual style" placeholder="Cinematic, moody, high contrast" />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Episode count" placeholder="60" type="number" />
            <Field label="Duration in seconds" placeholder="75" type="number" />
          </div>
          <button type="submit" className="inline-flex items-center gap-2 rounded bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-500"><Plus size={17} /> Create draft</button>
        </form>
      </div>
    </MainLayout>
  );
}

function Field({ label, placeholder, type = 'text' }: { label: string; placeholder: string; type?: string }) {
  return <label className="block text-sm text-stone-300">{label}<input name={label.toLowerCase().replaceAll(' ', '-')} type={type} placeholder={placeholder} className="mt-2 block w-full border border-stone-700 bg-stone-900 px-3 py-3 text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-500" /></label>;
}
