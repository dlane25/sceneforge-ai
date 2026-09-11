import 'server-only';

import Link from 'next/link';
import { connection } from 'next/server';
import { signOut } from '@/auth';
import { optionalUser } from '@/lib/auth';

export async function SessionNav() {
  await connection();
  const user = await optionalUser();
  if (!user) return <Link href="/api/auth/signin" className="text-xs text-amber-300 hover:text-amber-200">Sign in</Link>;

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return <div className="flex items-center gap-3"><span className="text-xs text-stone-400">{user.displayName}</span><form action={signOutAction}><button type="submit" className="text-xs text-stone-500 hover:text-amber-300">Sign out</button></form></div>;
}
