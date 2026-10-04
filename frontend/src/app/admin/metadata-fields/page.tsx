'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { PlusIcon } from '@/components/icons';
import { RequireAuth } from '@/components/RequireAuth';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import type { MetadataField } from '@/lib/types';

const TYPES = ['text', 'textarea', 'url', 'phone', 'email', 'number'];

export default function Page() {
  return (
    <RequireAuth permission="metadata-fields.manage">
      <Fields />
    </RequireAuth>
  );
}

type Draft = Omit<MetadataField, '_id'> & { _id?: string };

function Fields() {
  const [toast, show] = useToast();
  const [items, setItems] = useState<MetadataField[]>([]);
  const [edit, setEdit] = useState<Draft | null>(null);

  const load = useCallback(() => {
    api.get<MetadataField[]>('/admin/metadata-fields').then(setItems).catch((e) => show(errorMessage(e), true));
  }, [show]);
  useEffect(load, [load]);

  const remove = async (f: MetadataField) => {
    if (!confirm(`Delete “${f.label}”? Values already saved on brands stay as brand-specific fields.`)) return;
    try {
      await api.del(`/admin/metadata-fields/${f._id}`);
      load();
    } catch (e) {
      show(errorMessage(e), true);
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 className="page-title">Metadata fields</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Shared extra fields offered on every brand form (owners can also add their own per brand).
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setEdit({ label: '', key: '', type: 'text', sortOrder: items.length + 1, active: true })}
        >
          <PlusIcon /> New field
        </button>
      </div>
      <section className="glass card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Key</th>
              <th>Type</th>
              <th className="num">Order</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f._id}>
                <td>
                  <strong>{f.label}</strong>
                </td>
                <td className="muted">{f.key}</td>
                <td>{f.type}</td>
                <td className="num">{f.sortOrder}</td>
                <td>
                  <span className={`chip ${f.active ? 'chip-success' : ''}`}>{f.active ? 'Active' : 'Hidden'}</span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm" onClick={() => setEdit(f)}>
                    Edit
                  </button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(f)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty">No shared fields yet.</div>}
      </section>
      <Dialog open={!!edit} onClose={() => setEdit(null)} label="Metadata field" size="sm">
        {edit && (
          <FieldForm
            initial={edit}
            onSaved={() => {
              setEdit(null);
              show('Saved');
              load();
            }}
          />
        )}
      </Dialog>
      {toast}
    </div>
  );
}

function FieldForm({ initial, onSaved }: { initial: Draft; onSaved: () => void }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const isNew = !initial._id;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { label: v.label, type: v.type, sortOrder: Number(v.sortOrder), active: v.active };
    try {
      if (isNew) await api.post('/admin/metadata-fields', { ...body, key: v.key });
      else await api.patch(`/admin/metadata-fields/${initial._id}`, body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form className="dialog-body stack" onSubmit={submit}>
      <h2>{isNew ? 'New field' : `Edit ${initial.label}`}</h2>
      <label className="field">
        <span>Label</span>
        <input
          className="input"
          required
          value={v.label}
          onChange={(e) => {
            const label = e.target.value;
            setV((s) => ({
              ...s,
              label,
              key: isNew ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) : s.key,
            }));
          }}
        />
      </label>
      <label className="field">
        <span>Key</span>
        <input className="input" required pattern="[a-z0-9_\-]{1,40}" disabled={!isNew} value={v.key} onChange={(e) => setV({ ...v, key: e.target.value })} />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Type</span>
          <select className="select" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Order</span>
          <input className="input" type="number" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
        Show on brand forms
      </label>
      {error && <div className="alert">{error}</div>}
      <button className="btn btn-primary">Save</button>
    </form>
  );
}
