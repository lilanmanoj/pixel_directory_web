'use client';

import { useEffect, useRef, useState } from 'react';
import { number } from '@/lib/format';
import type { DailyPoint } from '@/lib/types';

const H = 220;
const PAD = { top: 30, right: 8, bottom: 26, left: 36 };

/** Rounded-top bar path: 4px radius at the data end, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / pow) * pow;
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Daily clicks as columns, with a hover tooltip per day and a table view. */
export function ClicksChart({ data, title = 'Clicks per day' }: { data: DailyPoint[]; title?: string }) {
  const [active, setActive] = useState<number | null>(null);
  // Draw at the container's real pixel width so bars and labels keep their intended size.
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!data.length) return null;

  const max = niceMax(Math.max(...data.map((d) => d.clicks)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.max(2, Math.min(24, slot - 2)); // 2px gap between touching bars
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70)));
  const point = active !== null ? data[active] : null;

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="muted small" style={{ marginBottom: 6 }}>
        {title} · UTC days
      </figcaption>
      <div className="chart-wrap" ref={wrap}>
        <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, ${data.length} days`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart-axis" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="chart-label" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
                {number(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const h = Math.max(0, y(0) - y(d.clicks));
            return (
              <g key={d.date} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                {/* Hit target spans the full slot and height, bigger than the mark. */}
                <rect className="chart-hit" x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} />
                {h > 0 && <path className={`chart-bar ${active === i ? 'is-active' : ''}`} d={barPath(cx - barW / 2, y(d.clicks), barW, h)} />}
                {i % labelEvery === 0 && (
                  <text className="chart-label" x={cx} y={H - 8} textAnchor="middle">
                    {fmtDay(d.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {point && active !== null && (
          <div
            className="chart-tip"
            style={{
              left: `${((PAD.left + slot * active + slot / 2) / W) * 100}%`,
              top: `${(y(point.clicks) / H) * 100}%`,
            }}
          >
            <strong>{number(point.clicks)}</strong> click{point.clicks === 1 ? '' : 's'} · {fmtDay(point.date)}
          </div>
        )}
      </div>
      <details style={{ marginTop: 8 }}>
        <summary className="muted small" style={{ cursor: 'pointer' }}>
          View as table
        </summary>
        <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{fmtDay(d.date)}</td>
                  <td className="num">{number(d.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
