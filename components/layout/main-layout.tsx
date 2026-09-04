'use client';

import Link from 'next/link';

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-stone-950 text-stone-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-stone-800 bg-stone-900 p-6">
        <Link href="/" className="mb-8 block">
          <h1 className="text-2xl font-bold text-amber-400">SceneForge AI</h1>
          <p className="mt-1 text-xs text-stone-400">From idea to series.</p>
        </Link>

        <nav className="space-y-4">
          <Link
            href="/dashboard"
            className="block rounded px-4 py-2 text-sm hover:bg-stone-800 hover:text-amber-300"
          >
            Dashboard
          </Link>
          <Link
            href="/series"
            className="block rounded px-4 py-2 text-sm hover:bg-stone-800 hover:text-amber-300"
          >
            Series
          </Link>
          <Link
            href="/studio"
            className="block rounded px-4 py-2 text-sm hover:bg-stone-800 hover:text-amber-300"
          >
            Studio
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
