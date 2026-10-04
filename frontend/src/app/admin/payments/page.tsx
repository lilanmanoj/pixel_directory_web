'use client';

import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { api, errorMessage } from '@/lib/api';
import { dateTime, money, statusChip } from '@/lib/format';
import type { Paged, Payment } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="payments.view">
      <Payments />
    </RequireAuth>
  );
}

function Payments() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<(Paged<Payment> & { revenue: number; currency: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Paged<Payment> & { revenue: number; currency: string }>('/admin/payments', { status, page, limit: 25 })
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [status, page]);

  return (
    <div className="stack">
      <div className="row-between">
        <h1 className="page-title">Payments</h1>
        <select
          className="select"
          style={{ width: 'auto' }}
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {error && <div className="alert">{error}</div>}
      {data && (
        <div className="stats">
          <div className="glass stat">
            <div className="stat-label">Revenue (paid)</div>
            <div className="stat-value">{money(data.revenue, data.currency)}</div>
          </div>
          <div className="glass stat">
            <div className="stat-label">{status ? `${status} payments` : 'Payments'}</div>
            <div className="stat-value">{data.total}</div>
          </div>
        </div>
      )}
      <section className="glass card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>User</th>
              <th>Change</th>
              <th className="num">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p._id}>
                <td className="small">{dateTime(p.createdAt)}</td>
                <td>{p.brand?.name ?? '—'}</td>
                <td className="small">
                  {p.user?.name}
                  <div className="muted">{p.user?.email}</div>
                </td>
                <td className="small">
                  {p.fromSize?.name} → {p.toSize?.name}
                </td>
                <td className="num">{money(p.amount, p.currency)}</td>
                <td>
                  <span className={`chip ${statusChip[p.status]}`}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <div className="empty">No payments yet.</div>}
        {data && data.total > data.limit && (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button className="btn btn-sm" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
