'use client';

import { useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth, type SessionUser } from '@/lib/auth';

export default function Page() {
  return (
    <main className="container page" style={{ maxWidth: 720 }}>
      <RequireAuth>
        <Profile />
      </RequireAuth>
    </main>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const [toast, show] = useToast();

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">My profile</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {user?.roleName ? `Role: ${user.roleName}` : 'No role assigned'}
        </p>
      </div>
      {user && (
        <>
          <DetailsForm
            user={user}
            onSaved={(u) => {
              setUser(u);
              show('Profile saved');
            }}
          />
          <PasswordForm
            onSaved={(u) => {
              setUser(u);
              show('Password changed — other sessions were signed out');
            }}
          />
        </>
      )}
      {toast}
    </div>
  );
}

function DetailsForm({ user, onSaved }: { user: SessionUser; onSaved: (u: SessionUser) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailChanged = email.trim().toLowerCase() !== user.email;
  const dirty = name.trim() !== user.name || emailChanged;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { name: name.trim() };
      if (emailChanged) Object.assign(body, { email: email.trim(), currentPassword });
      onSaved(await api.patch<SessionUser>('/auth/me', body));
      setCurrentPassword('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="glass card stack" onSubmit={submit}>
      <h2 style={{ fontSize: 18 }}>Details</h2>
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input className="input" required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      {emailChanged && (
        <label className="field" style={{ maxWidth: 340 }}>
          <span>Current password (required to change email)</span>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
      )}
      {error && <div className="alert">{error}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm({ onSaved }: { onSaved: (u: SessionUser) => void }) {
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.next !== v.confirm) return setError('The new passwords do not match');
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.patch<SessionUser>('/auth/me', { currentPassword: v.current, newPassword: v.next }));
      setV({ current: '', next: '', confirm: '' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof v, label: string, autoComplete: string, minLength?: number) => (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        type="password"
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
      />
    </label>
  );

  return (
    <form className="glass card stack" onSubmit={submit}>
      <div>
        <h2 style={{ fontSize: 18 }}>Change password</h2>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          You stay signed in here; other devices are signed out.
        </p>
      </div>
      <div className="form-grid">
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password (min. 8 characters)', 'new-password', 8)}
        {field('confirm', 'Confirm new password', 'new-password', 8)}
      </div>
      {error && <div className="alert">{error}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
