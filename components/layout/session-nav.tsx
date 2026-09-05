import Link from 'next/link';
import { optionalUser } from '@/lib/auth';

export async function SessionNav() {
  const user = await optionalUser();
  if (!user) return <Link href="/api/auth/signin" className="text-xs text-amber-300 hover:text-amber-200">Sign in</Link>;
  return <div className="flex items-center gap-3"><span className="text-xs text-stone-400">{user.displayName}</span><Link href="/api/auth/signout?callbackUrl=/" className="text-xs text-stone-500 hover:text-amber-300">Sign out</Link></div>;
}
