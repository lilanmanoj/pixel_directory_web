'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ADMIN_SECTIONS, useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import { SearchIcon } from './icons';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-bar glass">
          <Link href="/" className="logo" aria-label="Pixel Directory home">
            <span className="logo-mark" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="logo-text">Pixel Directory</span>
          </Link>
          <Suspense fallback={<div className="search" />}>
            <SearchBox />
          </Suspense>
          <div className="row header-actions" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

/** The query lives in the URL (?q=) so results are linkable and survive reloads. */
function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [value, setValue] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setValue(urlQuery), [urlQuery]);

  const push = (q: string) => {
    const target = q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/';
    if (pathname === '/') router.replace(target, { scroll: false });
    else router.push(target);
  };

  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        push(value);
      }}
    >
      <SearchIcon />
      <label htmlFor="site-search" className="sr-only">
        Search brands
      </label>
      <input
        id="site-search"
        className="input"
        type="search"
        placeholder="Search brands, services, places…"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          const q = e.target.value;
          setValue(q);
          clearTimeout(timer.current);
          // Live search only on the home page; elsewhere wait for Enter.
          if (pathname === '/') timer.current = setTimeout(() => push(q), 300);
        }}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => {
            setValue('');
            push('');
          }}
        >
          ×
        </button>
      )}
    </form>
  );
}

function UserMenu() {
  const { user, loading, signOut, can } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (loading) return <span className="btn btn-icon" aria-hidden />;
  if (!user)
    return (
      <Link href="/signin" className="btn btn-primary">
        Sign in
      </Link>
    );

  const adminLink = ADMIN_SECTIONS.find((s) => can(s.permission));
  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="btn"
        style={{ paddingLeft: 5 }}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar">{initials(user.name)}</span>
        <span className="truncate" style={{ maxWidth: 120 }}>
          {user.name.split(' ')[0]}
        </span>
      </button>
      {open && (
        <div className="menu-panel glass glass-strong" role="menu">
          <div style={{ padding: '8px 12px 10px' }}>
            <div className="truncate" style={{ fontWeight: 600 }}>
              {user.name}
            </div>
            <div className="muted small truncate">{user.email}</div>
            {user.roleName && <span className="chip" style={{ marginTop: 6 }}>{user.roleName}</span>}
          </div>
          <Link href="/profile" role="menuitem">
            My profile
          </Link>
          {can('own-brands.read') && (
            <Link href="/dashboard" role="menuitem">
              My brands
            </Link>
          )}
          {adminLink && (
            <Link href={adminLink.href} role="menuitem">
              Admin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await signOut();
              router.push('/');
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
