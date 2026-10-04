'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { PlusIcon } from '@/components/icons';
import { RequireAuth } from '@/components/RequireAuth';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import type { Permission, Role } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="roles.manage">
      <RolesAndPermissions />
    </RequireAuth>
  );
}

function RolesAndPermissions() {
  const [toast, show] = useToast();
  const [tab, setTab] = useState<'roles' | 'permissions'>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editRole, setEditRole] = useState<Partial<Role> | null>(null);
  const [editPerm, setEditPerm] = useState<Partial<Permission> | null>(null);

  const load = useCallback(() => {
    api.get<Role[]>('/admin/roles', { includeDeleted: showDeleted }).then(setRoles).catch((e) => show(errorMessage(e), true));
    api.get<Permission[]>('/admin/permissions').then(setPerms).catch((e) => show(errorMessage(e), true));
  }, [showDeleted, show]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      show(msg);
      load();
    } catch (e) {
      show(errorMessage(e), true);
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 className="page-title">Roles & permissions</h1>
        <div className="row" style={{ gap: 6 }} role="tablist">
          <button role="tab" aria-selected={tab === 'roles'} className={`btn btn-sm ${tab === 'roles' ? 'btn-primary' : ''}`} onClick={() => setTab('roles')}>
            Roles
          </button>
          <button
            role="tab"
            aria-selected={tab === 'permissions'}
            className={`btn btn-sm ${tab === 'permissions' ? 'btn-primary' : ''}`}
            onClick={() => setTab('permissions')}
          >
            Permissions
          </button>
        </div>
      </div>

      {tab === 'roles' ? (
        <>
          <div className="row-between">
            <label className="check small">
              <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
              Show deleted roles
            </label>
            <button className="btn btn-primary" onClick={() => setEditRole({ name: '', description: '', permissions: [], isDefault: false })}>
              <PlusIcon /> New role
            </button>
          </div>
          <div className="stack">
            {roles.map((r) => (
              <section key={r._id} className="glass card stack" style={{ gap: 10, opacity: r.deletedAt ? 0.6 : 1 }}>
                <div className="row-between">
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <h2 style={{ fontSize: 18 }}>{r.name}</h2>
                      {r.isSystem && <span className="chip">system</span>}
                      {r.isDefault && <span className="chip chip-success">sign-up default</span>}
                      {r.deletedAt && <span className="chip chip-danger">deleted</span>}
                    </div>
                    <p className="muted small" style={{ margin: '2px 0 0' }}>
                      {r.description || 'No description'} · {r.userCount ?? 0} user{r.userCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {r.deletedAt ? (
                      <button className="btn btn-sm" onClick={() => act(() => api.post(`/admin/roles/${r._id}/restore`), 'Role restored')}>
                        Restore
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-sm" onClick={() => setEditRole(r)}>
                          Edit
                        </button>
                        {!r.isSystem && !r.isDefault && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() =>
                              confirm(`Delete “${r.name}”? Its ${r.userCount ?? 0} user(s) lose these permissions until it is restored.`) &&
                              act(() => api.del(`/admin/roles/${r._id}`), 'Role deleted')
                            }
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {r.permissions.includes('*') ? (
                    <span className="chip chip-warning">All permissions</span>
                  ) : r.permissions.length ? (
                    r.permissions.map((p) => (
                      <span key={p} className="chip">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="muted small">No permissions</span>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="row-between">
            <p className="muted small" style={{ margin: 0, maxWidth: 620 }}>
              Built-in permissions are enforced by the API. Custom permissions can be created and attached to roles for
              your own conventions or future features.
            </p>
            <button className="btn btn-primary" onClick={() => setEditPerm({ key: '', group: 'Custom', description: '' })}>
              <PlusIcon /> New permission
            </button>
          </div>
          <section className="glass card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Group</th>
                  <th>Description</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {perms.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <code>{p.key}</code> {p.isSystem && <span className="chip">built-in</span>}
                    </td>
                    <td>{p.group}</td>
                    <td className="muted">{p.description}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => setEditPerm(p)}>
                        Edit
                      </button>{' '}
                      {!p.isSystem && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() =>
                            confirm(`Delete “${p.key}”? It will be removed from every role.`) &&
                            act(() => api.del(`/admin/permissions/${p._id}`), 'Permission deleted')
                          }
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <Dialog open={!!editRole} onClose={() => setEditRole(null)} label="Role">
        {editRole && (
          <RoleForm
            initial={editRole}
            permissions={perms}
            onSaved={() => {
              setEditRole(null);
              show('Role saved');
              load();
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!editPerm} onClose={() => setEditPerm(null)} label="Permission" size="sm">
        {editPerm && (
          <PermissionForm
            initial={editPerm}
            onSaved={() => {
              setEditPerm(null);
              show('Permission saved');
              load();
            }}
          />
        )}
      </Dialog>
      {toast}
    </div>
  );
}

function RoleForm({ initial, permissions, onSaved }: { initial: Partial<Role>; permissions: Permission[]; onSaved: () => void }) {
  const [name, setName] = useState(initial.name ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [isDefault, setIsDefault] = useState(!!initial.isDefault);
  const [selected, setSelected] = useState(new Set(initial.permissions ?? []));
  const [error, setError] = useState<string | null>(null);
  const locked = !!initial.isSystem;

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) map.set(p.group, [...(map.get(p.group) ?? []), p]);
    return [...map];
  }, [permissions]);

  const toggle = (key: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { name, description };
    if (!locked) body.permissions = [...selected];
    if (isDefault && !initial.isDefault) body.isDefault = true;
    try {
      if (initial._id) await api.patch(`/admin/roles/${initial._id}`, body);
      else await api.post('/admin/roles', body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form className="dialog-body stack" onSubmit={submit}>
      <h2>{initial._id ? `Edit ${initial.name}` : 'New role'}</h2>
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input className="input" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <input className="input" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={isDefault} disabled={!!initial.isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Give this role to new sign-ups
      </label>
      {locked ? (
        <p className="muted">This system role always has every permission.</p>
      ) : (
        groups.map(([group, items]) => (
          <fieldset key={group} className="glass" style={{ padding: 14, boxShadow: 'none', margin: 0 }}>
            <legend className="small" style={{ padding: '0 6px', fontWeight: 600 }}>
              {group}
            </legend>
            <div className="stack" style={{ gap: 8 }}>
              {items.map((p) => (
                <label key={p.key} className="check" style={{ alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                  <span>
                    <code>{p.key}</code>
                    <span className="muted small" style={{ display: 'block' }}>
                      {p.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))
      )}
      {error && <div className="alert">{error}</div>}
      <button className="btn btn-primary">Save role</button>
    </form>
  );
}

function PermissionForm({ initial, onSaved }: { initial: Partial<Permission>; onSaved: () => void }) {
  const [v, setV] = useState({ key: initial.key ?? '', group: initial.group ?? 'Custom', description: initial.description ?? '' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initial._id) await api.patch(`/admin/permissions/${initial._id}`, { group: v.group, description: v.description });
      else await api.post('/admin/permissions', v);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form className="dialog-body stack" onSubmit={submit}>
      <h2>{initial._id ? 'Edit permission' : 'New permission'}</h2>
      <label className="field">
        <span>Key</span>
        <input
          className="input"
          required
          pattern="[a-z0-9][a-z0-9.\-_:]{1,79}"
          placeholder="e.g. reports.export"
          disabled={!!initial._id}
          value={v.key}
          onChange={(e) => setV({ ...v, key: e.target.value.toLowerCase() })}
        />
      </label>
      <label className="field">
        <span>Group</span>
        <input className="input" maxLength={40} value={v.group} onChange={(e) => setV({ ...v, group: e.target.value })} />
      </label>
      <label className="field">
        <span>Description</span>
        <input className="input" maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </label>
      {error && <div className="alert">{error}</div>}
      <button className="btn btn-primary">Save</button>
    </form>
  );
}
