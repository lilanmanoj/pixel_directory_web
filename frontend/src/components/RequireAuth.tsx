'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

/**
 * Client-side gate for signed-in areas. The API enforces every permission on
 * its own; this only decides what to render.
 */
export function RequireAuth({ permission, children }: { permission?: string; children: React.ReactNode }) {
  const { user, loading, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) return <div className="empty">Loading…</div>;
  if (permission && !can(permission))
    return (
      <div className="empty glass card">
        <h2>No access</h2>
        <p>Your role doesn’t include this section. Ask an administrator if you need it.</p>
        <Link className="btn" href="/">
          Back to directory
        </Link>
      </div>
    );
  return <>{children}</>;
}
