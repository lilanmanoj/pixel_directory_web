'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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

  const update = async (u: AdminUser, body: { roleId?: string | null; active?: boolean }) => {
    try {
      const updated = await api.patch<AdminUser>(`/admin/users/${u._id}`, body);
      setData((d) => d && { ...d, items: d.items.map((x) => (x._id === u._id ? updated : x)) });
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
              {can('brands.read') && <th />}
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
                  {can('brands.read') && (
                    <td style={{ textAlign: 'right' }}>
                      <Link className="btn btn-sm" href={`/admin/brands?owner=${u._id}`}>
                        Brands
                      </Link>
                    </td>
                  )}
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
      {toast}
    </div>
  );
}
