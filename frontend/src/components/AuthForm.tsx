'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAuth, type SessionUser } from '@/lib/auth';

/** Only same-site relative paths are honoured as post-login redirects. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const { setUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = signup ? form : { email: form.email, password: form.password };
      const user = await api.post<SessionUser>(`/auth/${mode}`, body);
      setUser(user);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <main className="container auth-wrap">
      <form className="auth-card glass stack" onSubmit={submit}>
        <div>
          <h1 className="page-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {signup ? 'Manage the brands allocated to you.' : 'Sign in to manage your brands.'}
          </p>
        </div>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {signup && (
          <label className="field">
            <span>Name</span>
            <input className="input" required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={set('name')} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            required
            minLength={signup ? 8 : 1}
            autoComplete={signup ? 'new-password' : 'current-password'}
            value={form.password}
            onChange={set('password')}
          />
          {signup && <small className="muted">At least 8 characters.</small>}
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : signup ? 'Sign up' : 'Sign in'}
        </button>
        <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>
          {signup ? 'Already have an account? ' : 'New here? '}
          <Link href={`${signup ? '/signin' : '/signup'}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>
            {signup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </form>
    </main>
  );
}
