'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { SizeGlyph } from '@/components/SizePicker';
import { api, errorMessage } from '@/lib/api';
import { accentGradient, dateTime, initials, money, number, statusChip } from '@/lib/format';
import type { Brand, Payment } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="own-brands.read">
      <MyBrands />
    </RequireAuth>
  );
}

function MyBrands() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Brand[]>('/my/brands').then(setBrands).catch((e) => setError(errorMessage(e)));
    api.get<Payment[]>('/my/payments').then(setPayments).catch(() => undefined);
  }, []);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">My brands</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Brands an administrator has allocated to you. Edit their content or upgrade their card size.
        </p>
      </div>
      {error && <div className="alert">{error}</div>}
      {brands && brands.length === 0 && (
        <div className="empty glass card">
          No brands are allocated to you yet. Once an administrator assigns one, it will appear here.
        </div>
      )}
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {brands?.map((b) => (
          <Link key={b._id} href={`/dashboard/brands/${b._id}`} className="glass" style={{ textDecoration: 'none', overflow: 'hidden' }}>
            <div style={{ aspectRatio: '16/9', background: accentGradient(b.accentColor), position: 'relative' }}>
              {b.bannerUrl ? (
                <img src={b.bannerUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="tile-initials" style={{ fontSize: 42 }}>
                  {initials(b.name)}
                </span>
              )}
            </div>
            <div style={{ padding: 14 }} className="stack">
              <div>
                <strong>{b.name}</strong>
                <div className="muted small truncate">{b.tagline || '—'}</div>
              </div>
              <div className="row-between small">
                <span className="row" style={{ gap: 6 }}>
                  <SizeGlyph colSpan={b.cardSize.colSpan} rowSpan={b.cardSize.rowSpan} /> {b.cardSize.name}
                </span>
                <span className={`chip ${b.active ? 'chip-success' : ''}`}>{b.active ? 'Live' : 'Hidden'}</span>
              </div>
              <span className="muted small">{number(b.clickCount ?? 0)} clicks</span>
            </div>
          </Link>
        ))}
      </div>

      {payments.length > 0 && (
        <section className="glass card">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>My payments</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Brand</th>
                  <th>Change</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td className="small">{dateTime(p.createdAt)}</td>
                    <td>{p.brand?.name}</td>
                    <td className="small">
                      {p.fromSize?.name} → {p.toSize?.name}
                    </td>
                    <td className="num">{money(p.amount, p.currency)}</td>
                    <td>
                      {p.status === 'pending' ? (
                        <Link href={`/dashboard/checkout/${p._id}`} className="chip chip-warning">
                          pending · pay now
                        </Link>
                      ) : (
                        <span className={`chip ${statusChip[p.status]}`}>{p.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
