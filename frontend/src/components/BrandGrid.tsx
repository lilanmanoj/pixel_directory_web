'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { accentGradient, initials } from '@/lib/format';
import type { Brand, Paged } from '@/lib/types';
import { useInfinite } from '@/lib/useInfinite';

const GAP = 12;

/** Column count and square cell size derived from the container width. */
function useGridMetrics() {
  const ref = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ cols: 0, cell: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const min = width < 480 ? 140 : width < 900 ? 165 : 190;
      const cols = Math.max(2, Math.floor((width + GAP) / (min + GAP)));
      setMetrics({ cols, cell: Math.floor((width - GAP * (cols - 1)) / cols) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...metrics };
}

/**
 * The public wall of brands. Cards span 1–4 columns/rows according to their
 * card size; `grid-auto-flow: dense` back-fills holes so mixed sizes pack
 * tightly. The order is a per-visit shuffle from the API.
 */
export function BrandGrid({ onOpen }: { onOpen: (brand: Brand) => void }) {
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 30));
  const { ref, cols, cell } = useGridMetrics();
  const feed = useInfinite(
    (page) => api.get<Paged<Brand>>('/public/brands', { page, limit: 30, seed }),
    'feed',
  );

  return (
    <>
      <div
        ref={ref}
        className="feed"
        style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: `${cell}px` } : undefined}
      >
        {cols > 0 &&
          feed.items.map((b) => (
            <BrandTile key={b._id} brand={b} cols={cols} onOpen={onOpen} />
          ))}
        {cols > 0 &&
          feed.loading &&
          Array.from({ length: feed.items.length ? 6 : 12 }, (_, i) => (
            <div key={`s${i}`} className="tile-skeleton" style={i % 5 === 0 ? { gridColumn: 'span 2', gridRow: 'span 2' } : undefined} />
          ))}
      </div>
      <div data-sentinel ref={feed.sentinelRef} className="sentinel" />
      <div className="feed-status">
        {feed.error ? (
          <span>
            {feed.error}{' '}
            <button className="btn btn-sm" onClick={() => feed.retry()}>
              Retry
            </button>
          </span>
        ) : !feed.loading && feed.items.length === 0 ? (
          'No brands to show yet.'
        ) : !feed.hasMore ? (
          `That's everyone — ${feed.items.length} brands.`
        ) : null}
      </div>
    </>
  );
}

function BrandTile({ brand, cols, onOpen }: { brand: Brand; cols: number; onOpen: (b: Brand) => void }) {
  const [imgOk, setImgOk] = useState(true);
  const size = brand.cardSize;
  const colSpan = Math.min(size?.colSpan ?? 1, cols);
  const rowSpan = size?.rowSpan ?? 1;
  const isLarge = colSpan >= 2 && rowSpan >= 2;
  const isSmall = colSpan === 1 && rowSpan === 1;

  return (
    <button
      type="button"
      className="tile"
      data-size={isLarge ? 'large' : isSmall ? 'small' : 'medium'}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
        ['--tile-bg' as string]: accentGradient(brand.accentColor),
      }}
      onClick={() => onOpen(brand)}
      aria-label={`${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ''}`}
    >
      {brand.bannerUrl && imgOk ? (
        <img className="tile-img" src={brand.bannerUrl} alt="" loading="lazy" onError={() => setImgOk(false)} />
      ) : (
        <span className="tile-initials" aria-hidden>
          {initials(brand.name)}
        </span>
      )}
      <span className="tile-label">
        {brand.logoUrl && <img className="tile-logo" src={brand.logoUrl} alt="" loading="lazy" />}
        <span className="grow">
          <span className="tile-name truncate" style={{ display: 'block' }}>
            {brand.name}
          </span>
          {brand.tagline && (
            <span className="tile-tagline truncate" style={{ display: 'block' }}>
              {brand.tagline}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
