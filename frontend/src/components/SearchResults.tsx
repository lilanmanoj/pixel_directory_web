'use client';

import { api } from '@/lib/api';
import { accentGradient, initials } from '@/lib/format';
import type { Brand, Paged } from '@/lib/types';
import { useInfinite } from '@/lib/useInfinite';

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

/** Snippet of the description centred on the first match. */
function snippet(text: string, query: string, max = 220) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0 || text.length <= max) return text.slice(0, max) + (text.length > max ? '…' : '');
  const start = Math.max(0, i - 60);
  return (start > 0 ? '…' : '') + text.slice(start, start + max) + (start + max < text.length ? '…' : '');
}

export function SearchResults({ query, onOpen }: { query: string; onOpen: (brand: Brand) => void }) {
  const results = useInfinite(
    (page) => api.get<Paged<Brand>>('/public/brands', { q: query, page, limit: 20 }),
    `q:${query}`,
  );

  return (
    <section className="results" aria-live="polite">
      <p className="muted small" style={{ margin: '4px 4px 0' }}>
        {results.total === null ? 'Searching…' : `${results.total} result${results.total === 1 ? '' : 's'} for “${query}”`}
      </p>
      {results.items.map((b) => (
        <button key={b._id} type="button" className="result glass" onClick={() => onOpen(b)}>
          {b.logoUrl || b.bannerUrl ? (
            <img className="result-thumb" src={b.logoUrl || b.bannerUrl} alt="" loading="lazy" />
          ) : (
            <span className="result-thumb" style={{ background: accentGradient(b.accentColor) }} aria-hidden>
              {initials(b.name)}
            </span>
          )}
          <span className="grow">
            <strong>
              <Highlight text={b.name} query={query} />
            </strong>
            {b.tagline && (
              <span className="muted">
                {' '}
                · <Highlight text={b.tagline} query={query} />
              </span>
            )}
            {b.description && (
              <p className="result-desc">
                <Highlight text={snippet(b.description, query)} query={query} />
              </p>
            )}
          </span>
        </button>
      ))}
      <div data-sentinel ref={results.sentinelRef} className="sentinel" />
      {results.loading && <p className="feed-status">Loading…</p>}
      {results.error && <p className="feed-status">{results.error}</p>}
      {results.total === 0 && <div className="empty glass">No brands match “{query}”. Try another word.</div>}
    </section>
  );
}
