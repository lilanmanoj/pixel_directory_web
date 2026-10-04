'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { PlusIcon } from '@/components/icons';
import { RequireAuth } from '@/components/RequireAuth';
import { SizeGlyph } from '@/components/SizePicker';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { accentGradient, initials, number } from '@/lib/format';
import type { Brand, CardSize, Paged } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="brands.read">
      <Suspense>
        <BrandsAdmin />
      </Suspense>
    </RequireAuth>
  );
}

function BrandsAdmin() {
  const { can } = useAuth();
  const [toast, show] = useToast();
  const [sizes, setSizes] = useState<CardSize[]>([]);
  const owner = useSearchParams().get('owner') ?? '';
  const [filters, setFilters] = useState({ q: '', status: '', size: '', sort: 'recent', owner });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Brand> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ items: CardSize[] }>('/card-sizes').then((r) => setSizes(r.items)).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    api
      .get<Paged<Brand>>('/admin/brands', { ...filters, page, limit: 20 })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [filters, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const setFilter = (k: keyof typeof filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const toggle = async (b: Brand) => {
    try {
      await api.patch(`/admin/brands/${b._id}`, { active: !b.active });
      setData((d) => d && { ...d, items: d.items.map((x) => (x._id === b._id ? { ...x, active: !b.active } : x)) });
      show(`${b.name} is now ${b.active ? 'inactive' : 'active'}`);
    } catch (e) {
      show(errorMessage(e), true);
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 className="page-title">Brands</h1>
        {can('brands.create') && (
          <Link href="/admin/brands/new" className="btn btn-primary">
            <PlusIcon /> New brand
          </Link>
        )}
      </div>

      {filters.owner && (
        <div className="row">
          <span className="chip">
            Showing brands allocated to one user
            <button
              type="button"
              aria-label="Clear user filter"
              onClick={() => setFilter('owner', '')}
              style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, padding: 0 }}
            >
              ×
            </button>
          </span>
        </div>
      )}
      <div className="glass card row">
        <input
          className="input"
          style={{ flex: '2 1 220px', width: 'auto' }}
          placeholder="Search name, slug or description…"
          value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)}
          aria-label="Search brands"
        />
        <select className="select" style={{ flex: '1 1 130px', width: 'auto' }} value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className="select" style={{ flex: '1 1 130px', width: 'auto' }} value={filters.size} onChange={(e) => setFilter('size', e.target.value)} aria-label="Card size">
          <option value="">All sizes</option>
          {sizes.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="select" style={{ flex: '1 1 130px', width: 'auto' }} value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">
          <option value="recent">Newest</option>
          <option value="clicks">Most clicked</option>
          <option value="name">Name</option>
        </select>
      </div>

      {error && <div className="alert">{error}</div>}
      <section className="glass card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Size</th>
                <th>Allocated to</th>
                <th className="num">Clicks</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((b) => (
                <tr key={b._id}>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      {b.logoUrl || b.bannerUrl ? (
                        <img className="thumb" src={b.logoUrl || b.bannerUrl} alt="" />
                      ) : (
                        <span className="thumb" style={{ background: accentGradient(b.accentColor) }}>
                          {initials(b.name)}
                        </span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{b.name}</div>
                        <div className="muted small truncate" style={{ maxWidth: 260 }}>
                          {b.tagline || b.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <SizeGlyph colSpan={b.cardSize?.colSpan ?? 1} rowSpan={b.cardSize?.rowSpan ?? 1} />
                      {b.cardSize?.name}
                    </div>
                  </td>
                  <td className="small">{b.owners?.length ? b.owners.map((o) => o.name).join(', ') : <span className="muted">—</span>}</td>
                  <td className="num">{number(b.clickCount ?? 0)}</td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      className="switch"
                      aria-checked={!!b.active}
                      aria-label={`${b.name} active`}
                      disabled={!can('brands.status')}
                      onClick={() => toggle(b)}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/admin/brands/${b._id}`} className="btn btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.items.length === 0 && <div className="empty">No brands match these filters.</div>}
          {!data && !error && <div className="empty">Loading…</div>}
        </div>
        {data && data.total > data.limit && (
          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="muted small">
              {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
            </span>
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
