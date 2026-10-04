'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { ADMIN_SECTIONS, useAuth } from '@/lib/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container page">
      <RequireAuth>
        <AdminShell>{children}</AdminShell>
      </RequireAuth>
    </main>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { can } = useAuth();
  const pathname = usePathname();
  const sections = ADMIN_SECTIONS.filter((s) => can(s.permission));
  const active = [...sections].sort((a, b) => b.href.length - a.href.length).find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));

  if (!sections.length)
    return (
      <div className="empty glass card">
        <h2>No admin access</h2>
        <p>Your role doesn’t include any admin sections.</p>
      </div>
    );

  return (
    <div className="shell">
      <nav className="sidenav glass" aria-label="Admin">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} aria-current={active?.href === s.href ? 'page' : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
