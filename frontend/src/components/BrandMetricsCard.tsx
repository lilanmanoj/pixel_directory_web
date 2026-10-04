'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { number } from '@/lib/format';
import type { BrandMetrics } from '@/lib/types';
import { ClicksChart } from './ClicksChart';

/** Click totals plus the daily chart for one brand. `base` picks the admin or owner endpoint. */
export function BrandMetricsCard({ id, base = '/admin/brands' }: { id: string; base?: string }) {
  const [days, setDays] = useState(30);
  const [m, setM] = useState<BrandMetrics | null>(null);

  useEffect(() => {
    api.get<BrandMetrics>(`${base}/${id}/metrics`, { days }).then(setM).catch(() => setM(null));
  }, [id, days, base]);

  return (
    <section className="glass card stack">
      <div className="row-between">
        <h2 style={{ fontSize: 18 }}>Click metrics</h2>
        <div className="row" style={{ gap: 6 }} role="group" aria-label="Time range">
          {[7, 30, 90].map((d) => (
            <button key={d} className={`btn btn-sm ${d === days ? 'btn-primary' : ''}`} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      {m ? (
        <>
          <div className="stats">
            <div className="glass stat">
              <div className="stat-label">Last {days} days</div>
              <div className="stat-value">{number(m.periodClicks)}</div>
            </div>
            <div className="glass stat">
              <div className="stat-label">All time</div>
              <div className="stat-value">{number(m.totalClicks)}</div>
            </div>
          </div>
          <ClicksChart data={m.daily} />
        </>
      ) : (
        <p className="muted">Loading…</p>
      )}
    </section>
  );
}
