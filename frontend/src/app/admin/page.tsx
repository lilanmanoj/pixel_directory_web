'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClicksChart } from '@/components/ClicksChart';
import { RequireAuth } from '@/components/RequireAuth';
import { api, errorMessage } from '@/lib/api';
import { accentGradient, initials, number } from '@/lib/format';
import type { DailyPoint } from '@/lib/types';

interface Summary {
  brands: { active: number; inactive: number };
  totalClicks: number;
  periodClicks: number;
  users: number;
  daily: DailyPoint[];
  top: { _id: string; name: string; clickCount: number; active: boolean; accentColor?: string; logoUrl?: string }[];
}

export default function AdminOverview() {
  return (
    <RequireAuth permission="metrics.view">
      <Overview />
    </RequireAuth>
  );
}

function Overview() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Summary>('/admin/metrics/summary', { days }).then(setData).catch((e) => setError(errorMessage(e)));
  }, [days]);

  return (
    <div className="stack">
      <div className="row-between">
        <h1 className="page-title">Overview</h1>
        <div className="row" style={{ gap: 6 }} role="group" aria-label="Time range">
          {[7, 30, 90].map((d) => (
            <button key={d} className={`btn btn-sm ${d === days ? 'btn-primary' : ''}`} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      {data && (
        <>
          <div className="stats">
            <Stat label={`Clicks · last ${days} days`} value={data.periodClicks} />
            <Stat label="Clicks · all time" value={data.totalClicks} />
            <Stat label="Active brands" value={data.brands.active} />
            <Stat label="Inactive brands" value={data.brands.inactive} />
            <Stat label="Users" value={data.users} />
          </div>
          <section className="glass card">
            <ClicksChart data={data.daily} title="Clicks per day, all brands" />
          </section>
          <section className="glass card">
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Most clicked brands</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Status</th>
                    <th className="num">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <Link href={`/admin/brands/${b._id}`} className="row" style={{ textDecoration: 'none', flexWrap: 'nowrap' }}>
                          {b.logoUrl ? (
                            <img className="thumb" src={b.logoUrl} alt="" />
                          ) : (
                            <span className="thumb" style={{ background: accentGradient(b.accentColor) }}>
                              {initials(b.name)}
                            </span>
                          )}
                          {b.name}
                        </Link>
                      </td>
                      <td>
                        <span className={`chip ${b.active ? 'chip-success' : ''}`}>{b.active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="num">{number(b.clickCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{number(value)}</div>
    </div>
  );
}
