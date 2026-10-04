'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { RequireAuth } from '@/components/RequireAuth';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date } from '@/lib/format';
import type { AdminUser, Paged, Role } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="users.manage">
      <Users />
    </RequireAuth>
  );
}

function Users() {
  const { user: me, can } = useAuth();
  const [toast, show] = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminUser> | null>(null);
  const [roles, setRoles] = useState<Pick<Role, '_id' | 'name'>[]>([]);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  useEffect(() => {
    api.get<Role[]>('/admin/users/roles').then(setRoles).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    api.get<Paged<AdminUser>>('/admin/users', { q, page, limit: 25 }).then(setData).catch((e) => show(errorMessage(e), true));
  }, [q, page, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const replace = (updated: AdminUser) =>
    setData((d) => d && { ...d, items: d.items.map((x) => (x._id === updated._id ? updated : x)) });

  const update = async (u: AdminUser, body: { roleId?: string | null; active?: boolean }) => {
    try {
      replace(await api.patch<AdminUser>(`/admin/users/${u._id}`, body));
      show('Updated');
    } catch (e) {
      show(errorMessage(e), true);
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 className="page-title">Users</h1>
        {can('brands.read') && (
          <span className="muted small">Allocate brands to users from each brand’s page.</span>
        )}
      </div>
      <div className="glass card">
        <input
          className="input"
          placeholder="Search by name or email…"
          aria-label="Search users"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <section className="glass card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Last sign-in</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => {
              const self = u._id === me?.id;
              const roleGone = u.role?.deletedAt;
              return (
                <tr key={u._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {u.name} {self && <span className="chip">you</span>}
                    </div>
                    <div className="muted small">{u.email}</div>
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <select
                      className="select"
                      value={u.role && !roleGone ? u.role._id : ''}
                      disabled={self}
                      aria-label={`Role for ${u.name}`}
                      onChange={(e) => update(u, { roleId: e.target.value || null })}
                    >
                      <option value="">{roleGone ? `${u.role!.name} (deleted)` : 'No role'}</option>
                      {roles.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="small">{date(u.createdAt)}</td>
                  <td className="small">{date(u.lastLoginAt)}</td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      className="switch"
                      aria-checked={u.active}
                      aria-label={`${u.name} active`}
                      disabled={self}
                      onClick={() => update(u, { active: !u.active })}
                    />
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => setEditing(u)}>
                      Edit
                    </button>{' '}
                    {can('brands.read') && (
                      <Link className="btn btn-sm" href={`/admin/brands?owner=${u._id}`}>
                        Brands
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && data.items.length === 0 && <div className="empty">No users found.</div>}
        {data && data.total > data.limit && (
          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="muted small">{data.total} users</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button className="btn btn-sm" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </section>
      <Dialog open={!!editing} onClose={() => setEditing(null)} label="Edit user" size="sm">
        {editing && (
          <EditUserForm
            user={editing}
            roles={roles}
            isSelf={editing._id === me?.id}
            onSaved={(u) => {
              replace(u);
              setEditing(null);
              show('User saved');
            }}
          />
        )}
      </Dialog>
      {toast}
    </div>
  );
}

function EditUserForm({
  user,
  roles,
  isSelf,
  onSaved,
}: {
  user: AdminUser;
  roles: Pick<Role, '_id' | 'name'>[];
  isSelf: boolean;
  onSaved: (u: AdminUser) => void;
}) {
  const roleGone = !!user.role?.deletedAt;
  const [v, setV] = useState({
    name: user.name,
    email: user.email,
    roleId: user.role && !roleGone ? user.role._id : '',
    active: user.active,
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Send only what changed; role/status/password are never sent for your own account.
    const body: Record<string, unknown> = {};
    if (v.name.trim() !== user.name) body.name = v.name.trim();
    if (v.email.trim().toLowerCase() !== user.email) body.email = v.email.trim();
    if (!isSelf) {
      const currentRole = user.role && !roleGone ? user.role._id : '';
      if (v.roleId !== currentRole) body.roleId = v.roleId || null;
      if (v.active !== user.active) body.active = v.active;
      if (v.password) body.password = v.password;
    }
    try {
      onSaved(Object.keys(body).length ? await api.patch<AdminUser>(`/admin/users/${user._id}`, body) : user);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form className="dialog-body stack" onSubmit={submit}>
      <h2 style={{ paddingRight: 48 }}>Edit {user.name}</h2>
      <label className="field">
        <span>Name</span>
        <input className="input" required minLength={2} maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </label>
      {isSelf ? (
        <p className="muted small" style={{ margin: 0 }}>
          This is your account: change your password from <Link href="/profile">My profile</Link>. You can’t change your own role or
          deactivate yourself.
        </p>
      ) : (
        <>
          <label className="field">
            <span>Role</span>
            <select className="select" value={v.roleId} onChange={(e) => setV({ ...v, roleId: e.target.value })}>
              <option value="">{roleGone ? `${user.role!.name} (deleted)` : 'No role'}</option>
              {roles.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>New password (leave empty to keep the current one)</span>
            <input
              className="input"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={v.password}
              onChange={(e) => setV({ ...v, password: e.target.value })}
            />
            {v.password && <small className="muted">The user will be signed out everywhere.</small>}
          </label>
          <label className="check">
            <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
            Account active (inactive users cannot sign in)
          </label>
        </>
      )}
      {error && <div className="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save user'}
      </button>
    </form>
  );
}
