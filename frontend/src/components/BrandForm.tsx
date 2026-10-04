'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Brand, CardSize, MetadataField, MetadataValue, UserRef } from '@/lib/types';
import { ImageInput } from './ImageInput';
import { PlusIcon, TrashIcon } from './icons';
import { SizePicker } from './SizePicker';

export interface BrandContent {
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  images: string[];
  contactNumbers: string[];
  email: string;
  website: string;
  address: string;
  tags: string[];
  accentColor: string;
  metadata: MetadataValue[];
}

/** Content fields are omitted when the user may only change admin controls. */
export interface BrandPayload extends Partial<BrandContent> {
  cardSizeId?: string;
  active?: boolean;
  ownerIds?: string[];
}

interface Props {
  /** `admin` adds size, status and owner controls; `owner` edits content only. */
  mode: 'admin' | 'owner';
  initial?: Brand;
  sizes?: CardSize[];
  currency?: string;
  /** Which admin controls the current user may change. */
  allow?: { resize?: boolean; status?: boolean; assign?: boolean; content?: boolean };
  submitLabel: string;
  onSubmit: (payload: BrandPayload) => Promise<void>;
}

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);

export function BrandForm({ mode, initial, sizes = [], currency, allow = {}, submitLabel, onSubmit }: Props) {
  const [v, setV] = useState({
    name: initial?.name ?? '',
    tagline: initial?.tagline ?? '',
    description: initial?.description ?? '',
    logoUrl: initial?.logoUrl ?? '',
    bannerUrl: initial?.bannerUrl ?? '',
    images: initial?.images ?? [],
    contacts: (initial?.contactNumbers ?? []).join('\n'),
    email: initial?.email ?? '',
    website: initial?.website ?? '',
    address: initial?.address ?? '',
    tags: (initial?.tags ?? []).join(', '),
    accentColor: initial?.accentColor ?? '#7c8cff',
    cardSizeId: initial?.cardSize?._id ?? sizes[0]?._id ?? '',
    active: initial?.active ?? true,
  });
  const [owners, setOwners] = useState<UserRef[]>(initial?.owners ?? []);
  const [fields, setFields] = useState<MetadataField[]>([]);
  const [shared, setShared] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<MetadataValue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canEditContent = mode === 'owner' || allow.content !== false;

  // Split stored metadata into values for shared fields and brand-specific custom fields.
  useEffect(() => {
    api
      .get<MetadataField[]>('/metadata-fields')
      .then((defs) => {
        setFields(defs);
        const keys = new Set(defs.map((d) => d.key));
        const values: Record<string, string> = {};
        const rest: MetadataValue[] = [];
        for (const m of initial?.metadata ?? []) {
          if (m.key && keys.has(m.key)) values[m.key] = m.value;
          else rest.push({ ...m, key: null });
        }
        setShared(values);
        setCustom(rest);
      })
      .catch(() => setCustom(initial?.metadata ?? []));
  }, [initial]);

  useEffect(() => {
    if (!v.cardSizeId && sizes[0]) setV((s) => ({ ...s, cardSizeId: sizes[0]!._id }));
  }, [sizes, v.cardSizeId]);

  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));
  const text = (k: 'name' | 'tagline' | 'description' | 'email' | 'website' | 'address' | 'contacts' | 'tags') =>
    ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value) });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const metadata: MetadataValue[] = [
      ...fields
        .filter((f) => shared[f.key]?.trim())
        .map((f) => ({ key: f.key, label: f.label, type: f.type, value: shared[f.key]!.trim() })),
      ...custom.filter((c) => c.label.trim() && c.value.trim()).map((c) => ({ ...c, key: null })),
    ];
    const content: BrandContent = {
      name: v.name.trim(),
      tagline: v.tagline.trim(),
      description: v.description.trim(),
      logoUrl: v.logoUrl,
      bannerUrl: v.bannerUrl,
      images: v.images.filter(Boolean),
      contactNumbers: lines(v.contacts),
      email: v.email.trim(),
      website: v.website.trim(),
      address: v.address.trim(),
      tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean),
      accentColor: v.accentColor,
      metadata,
    };
    const payload: BrandPayload = canEditContent ? content : {};
    if (mode === 'admin') {
      if (allow.resize || !initial) payload.cardSizeId = v.cardSizeId;
      if (allow.status) payload.active = v.active;
      if (allow.assign) payload.ownerIds = owners.map((o) => o._id);
    }
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <fieldset disabled={!canEditContent} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <section className="glass card stack">
          <h2 style={{ fontSize: 18 }}>Basics</h2>
          <div className="form-grid">
            <label className="field">
              <span>Name *</span>
              <input className="input" required minLength={2} maxLength={80} {...text('name')} />
            </label>
            <label className="field">
              <span>Tagline</span>
              <input className="input" maxLength={140} placeholder="One line shown on the card" {...text('tagline')} />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea className="textarea" maxLength={5000} {...text('description')} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Tags (comma separated)</span>
              <input className="input" placeholder="coffee, cafe" {...text('tags')} />
            </label>
            <label className="field">
              <span>Accent colour (used when there is no banner)</span>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input
                  type="color"
                  value={v.accentColor}
                  onChange={(e) => set('accentColor', e.target.value)}
                  style={{ width: 48, height: 42, border: 0, background: 'none', padding: 0, cursor: 'pointer' }}
                />
                <input className="input" value={v.accentColor} readOnly aria-label="Accent colour hex" />
              </div>
            </label>
          </div>
        </section>

        <section className="glass card stack">
          <h2 style={{ fontSize: 18 }}>Images</h2>
          <div className="form-grid">
            <ImageInput label="Logo" value={v.logoUrl} onChange={(url) => set('logoUrl', url)} />
            <ImageInput label="Banner (card background)" value={v.bannerUrl} onChange={(url) => set('bannerUrl', url)} aspect="4/3" />
          </div>
          <div className="field">
            <span>Gallery (up to 12)</span>
            <div className="form-grid">
              {v.images.map((img, i) => (
                <ImageInput
                  key={i}
                  label={`Image ${i + 1}`}
                  value={img}
                  onChange={(url) => set('images', url ? v.images.map((x, j) => (j === i ? url : x)) : v.images.filter((_, j) => j !== i))}
                />
              ))}
            </div>
            {v.images.length < 12 && (
              <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('images', [...v.images, ''])}>
                <PlusIcon size={14} /> Add image
              </button>
            )}
          </div>
        </section>

        <section className="glass card stack">
          <h2 style={{ fontSize: 18 }}>Contact</h2>
          <div className="form-grid">
            <label className="field">
              <span>Phone numbers (one per line)</span>
              <textarea className="textarea" style={{ minHeight: 80 }} placeholder="+1 555 0100" {...text('contacts')} />
            </label>
            <div className="stack">
              <label className="field">
                <span>Website</span>
                <input className="input" type="url" placeholder="https://example.com" {...text('website')} />
              </label>
              <label className="field">
                <span>Email</span>
                <input className="input" type="email" {...text('email')} />
              </label>
            </div>
          </div>
          <label className="field">
            <span>Address</span>
            <input className="input" maxLength={300} {...text('address')} />
          </label>
        </section>

        <section className="glass card stack">
          <div>
            <h2 style={{ fontSize: 18 }}>More details</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              Shared fields appear on every brand. Add your own fields below for anything else.
            </p>
          </div>
          {fields.length > 0 && (
            <div className="form-grid">
              {fields.map((f) => (
                <label key={f.key} className="field">
                  <span>{f.label}</span>
                  {f.type === 'textarea' ? (
                    <textarea
                      className="textarea"
                      value={shared[f.key] ?? ''}
                      onChange={(e) => setShared((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className="input"
                      type={f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : f.type === 'phone' ? 'tel' : 'text'}
                      value={shared[f.key] ?? ''}
                      onChange={(e) => setShared((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          {custom.map((c, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: '1 1 160px' }}>
                <span>Field name</span>
                <input
                  className="input"
                  value={c.label}
                  maxLength={60}
                  onChange={(e) => setCustom((cs) => cs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
              </label>
              <label className="field" style={{ flex: '0 1 120px' }}>
                <span>Type</span>
                <select
                  className="select"
                  value={c.type ?? 'text'}
                  onChange={(e) => setCustom((cs) => cs.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                >
                  {['text', 'url', 'phone', 'email', 'number'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ flex: '2 1 220px' }}>
                <span>Value</span>
                <input
                  className="input"
                  value={c.value}
                  onChange={(e) => setCustom((cs) => cs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
              </label>
              <button
                type="button"
                className="btn btn-icon btn-danger"
                aria-label="Remove field"
                onClick={() => setCustom((cs) => cs.filter((_, j) => j !== i))}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setCustom((cs) => [...cs, { label: '', value: '', type: 'text', key: null }])}
          >
            <PlusIcon size={14} /> Add custom field
          </button>
        </section>
      </fieldset>

      {mode === 'admin' && (
        <section className="glass card stack">
          <h2 style={{ fontSize: 18 }}>Placement & access</h2>
          <div className="field">
            <span>Card size {!initial || allow.resize ? '' : '(you lack brands.resize)'}</span>
            <fieldset disabled={!!initial && !allow.resize} style={{ border: 0, padding: 0, margin: 0 }}>
              <SizePicker sizes={sizes} value={v.cardSizeId} onChange={(id) => set('cardSizeId', id)} currency={currency} />
            </fieldset>
          </div>
          {allow.status && (
            <label className="row">
              <button
                type="button"
                role="switch"
                className="switch"
                aria-checked={v.active}
                onClick={() => set('active', !v.active)}
              />
              <span>{v.active ? 'Active — visible on the directory' : 'Inactive — hidden from the directory'}</span>
            </label>
          )}
          {allow.assign && <OwnerPicker owners={owners} onChange={setOwners} />}
        </section>
      )}

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Allocate brand owners by searching users. */
function OwnerPicker({ owners, onChange }: { owners: UserRef[]; onChange: (o: UserRef[]) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserRef[]>([]);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(() => {
      api.get<UserRef[]>('/admin/users/lookup', { q }).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const candidates = results.filter((r) => !owners.some((o) => o._id === r._id));
  return (
    <div className="field">
      <span>Allocated users (can edit content and pay for upgrades)</span>
      <div className="row" style={{ gap: 6 }}>
        {owners.length === 0 && <span className="muted small">Nobody yet.</span>}
        {owners.map((o) => (
          <span key={o._id} className="chip">
            {o.name} <span className="muted">{o.email}</span>
            <button
              type="button"
              aria-label={`Remove ${o.name}`}
              onClick={() => onChange(owners.filter((x) => x._id !== o._id))}
              style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, padding: 0 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', maxWidth: 420 }}>
        <input className="input" placeholder="Search users by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        {candidates.length > 0 && (
          <div className="menu-panel glass glass-strong" style={{ left: 0, right: 0, zIndex: 5 }}>
            {candidates.map((u) => (
              <button
                key={u._id}
                type="button"
                onClick={() => {
                  onChange([...owners, u]);
                  setQ('');
                }}
              >
                {u.name} <span className="muted small">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
