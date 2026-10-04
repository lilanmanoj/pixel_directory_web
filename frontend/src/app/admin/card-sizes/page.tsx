'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { PlusIcon } from '@/components/icons';
import { RequireAuth } from '@/components/RequireAuth';
import { SizeGlyph } from '@/components/SizePicker';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import type { CardSize } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="card-sizes.manage">
      <CardSizes />
    </RequireAuth>
  );
}

type Draft = Omit<CardSize, '_id'> & { _id?: string };
const EMPTY: Draft = { name: '', key: '', colSpan: 1, rowSpan: 1, price: 0, sortOrder: 0, active: true };

function CardSizes() {
  const [toast, show] = useToast();
  const [data, setData] = useState<{ items: CardSize[]; currency: string } | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);

  const load = useCallback(() => {
    api.get<{ items: CardSize[]; currency: string }>('/admin/card-sizes').then(setData).catch((e) => show(errorMessage(e), true));
  }, [show]);
  useEffect(load, [load]);

  const remove = async (s: CardSize) => {
    if (!confirm(`Delete the “${s.name}” size?`)) return;
    try {
      await api.del(`/admin/card-sizes/${s._id}`);
      show('Deleted');
      load();
    } catch (e) {
      show(errorMessage(e), true);
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 className="page-title">Card sizes & prices</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Owners pay the price difference to move up a tier; moving down is free. Admins can resize freely.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit({ ...EMPTY, sortOrder: (data?.items.length ?? 0) + 1 })}>
          <PlusIcon /> New size
        </button>
      </div>
      <section className="glass card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Key</th>
              <th>Span</th>
              <th className="num">Price</th>
              <th className="num">Brands</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((s) => (
              <tr key={s._id}>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <SizeGlyph colSpan={s.colSpan} rowSpan={s.rowSpan} />
                    <strong>{s.name}</strong>
                  </div>
                </td>
                <td className="muted">{s.key}</td>
                <td>
                  {s.colSpan} × {s.rowSpan}
                </td>
                <td className="num">{money(s.price ?? 0, data.currency)}</td>
                <td className="num">{s.brandCount ?? 0}</td>
                <td>
                  <span className={`chip ${s.active ? 'chip-success' : ''}`}>{s.active ? 'Available' : 'Hidden'}</span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm" onClick={() => setEdit(s as Draft)}>
                    Edit
                  </button>{' '}
                  <button className="btn btn-sm btn-danger" disabled={!!s.brandCount} title={s.brandCount ? 'In use — hide it instead' : ''} onClick={() => remove(s)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Dialog open={!!edit} onClose={() => setEdit(null)} label="Card size" size="sm">
        {edit && (
          <SizeForm
            initial={edit}
            currency={data?.currency}
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

function SizeForm({ initial, currency, onSaved }: { initial: Draft; currency?: string; onSaved: () => void }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const isNew = !initial._id;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body = {
      name: v.name,
      colSpan: Number(v.colSpan),
      rowSpan: Number(v.rowSpan),
      price: Number(v.price),
      sortOrder: Number(v.sortOrder),
      active: v.active,
    };
    try {
      if (isNew) await api.post('/admin/card-sizes', { ...body, key: v.key });
      else await api.patch(`/admin/card-sizes/${initial._id}`, body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const num = (k: 'colSpan' | 'rowSpan' | 'price' | 'sortOrder') => ({
    value: v[k] ?? 0,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value as unknown as number }),
  });

  return (
    <form className="dialog-body stack" onSubmit={submit}>
      <h2>{isNew ? 'New card size' : `Edit ${initial.name}`}</h2>
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input className="input" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Key</span>
          <input
            className="input"
            required
            pattern="[a-z0-9-]{2,30}"
            disabled={!isNew}
            value={v.key}
            onChange={(e) => setV({ ...v, key: e.target.value.toLowerCase() })}
          />
        </label>
        <label className="field">
          <span>Columns (1–4)</span>
          <input className="input" type="number" min={1} max={4} required {...num('colSpan')} />
        </label>
        <label className="field">
          <span>Rows (1–4)</span>
          <input className="input" type="number" min={1} max={4} required {...num('rowSpan')} />
        </label>
        <label className="field">
          <span>Price ({currency})</span>
          <input className="input" type="number" min={0} step="0.01" required {...num('price')} />
        </label>
        <label className="field">
          <span>Sort order</span>
          <input className="input" type="number" {...num('sortOrder')} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={!!v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
        Available for owners to choose
      </label>
      <div className="row">
        <SizeGlyph colSpan={Number(v.colSpan) || 1} rowSpan={Number(v.rowSpan) || 1} />
        <span className="muted small">Preview of the card footprint</span>
      </div>
      {error && <div className="alert">{error}</div>}
      <button className="btn btn-primary">Save</button>
    </form>
  );
}
