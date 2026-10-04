'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { accentGradient, initials, safeUrl } from '@/lib/format';
import type { Brand, MetadataValue } from '@/lib/types';
import { Dialog } from './Dialog';
import { GlobeIcon, MailIcon, PhoneIcon, PinIcon } from './icons';

/**
 * Enlarged view of a card. Opens instantly with the data the card already
 * has, then fills in the full record. Opening it counts as one click.
 */
export function BrandDialog({ brand, onClose }: { brand: Brand | null; onClose: () => void }) {
  const [detail, setDetail] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (!brand) return;
    let live = true;
    api.post(`/public/brands/${brand._id}/click`).catch(() => undefined);
    api
      .get<Brand>(`/public/brands/${brand._id}`)
      .then((b) => live && setDetail(b))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [brand]);

  const b = detail ?? brand;
  return (
    <Dialog open={!!brand} onClose={onClose} label={b?.name ?? 'Brand'}>
      {b && <BrandDetail brand={b} loading={!detail && !error} error={error} />}
    </Dialog>
  );
}

export function BrandDetail({ brand: b, loading, error }: { brand: Brand; loading?: boolean; error?: string | null }) {
  const website = safeUrl(b.website);
  const metadata = (b.metadata ?? []).filter((m) => m.value?.trim());

  return (
    <>
      <div className="brand-hero" style={{ ['--tile-bg' as string]: accentGradient(b.accentColor) }}>
        {b.bannerUrl && <img src={b.bannerUrl} alt="" />}
      </div>
      <div className="brand-head">
        {b.logoUrl ? (
          <img className="brand-logo" src={b.logoUrl} alt={`${b.name} logo`} />
        ) : (
          <span className="brand-logo" style={{ background: accentGradient(b.accentColor) }} aria-hidden>
            {initials(b.name)}
          </span>
        )}
        <div className="brand-title">
          <h2 style={{ fontSize: 24 }}>{b.name}</h2>
          {b.tagline && <p className="muted" style={{ margin: '2px 0 0' }}>{b.tagline}</p>}
        </div>
      </div>

      <div className="dialog-body stack">
        {error && <div className="alert">{error}</div>}
        {b.tags && b.tags.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            {b.tags.map((t) => (
              <span key={t} className="chip">
                #{t}
              </span>
            ))}
          </div>
        )}
        {b.description && <p className="prose">{b.description}</p>}
        {loading && <p className="muted small">Loading details…</p>}

        {(b.contactNumbers?.length || b.email || website || b.address) && (
          <dl className="info-grid" style={{ margin: 0 }}>
            {b.contactNumbers?.map((n) => (
              <div className="info-item" key={n}>
                <dt className="row" style={{ gap: 6 }}>
                  <PhoneIcon size={14} /> Phone
                </dt>
                <dd>
                  <a href={`tel:${n.replace(/[^\d+]/g, '')}`}>{n}</a>
                </dd>
              </div>
            ))}
            {b.email && (
              <div className="info-item">
                <dt className="row" style={{ gap: 6 }}>
                  <MailIcon size={14} /> Email
                </dt>
                <dd>
                  <a href={`mailto:${b.email}`}>{b.email}</a>
                </dd>
              </div>
            )}
            {website && (
              <div className="info-item">
                <dt className="row" style={{ gap: 6 }}>
                  <GlobeIcon size={14} /> Website
                </dt>
                <dd>
                  <a href={website} target="_blank" rel="noopener noreferrer nofollow">
                    {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </dd>
              </div>
            )}
            {b.address && (
              <div className="info-item">
                <dt className="row" style={{ gap: 6 }}>
                  <PinIcon size={14} /> Address
                </dt>
                <dd>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {b.address}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}

        {metadata.length > 0 && (
          <dl className="info-grid" style={{ margin: 0 }}>
            {metadata.map((m, i) => (
              <div className="info-item" key={`${m.label}-${i}`}>
                <dt>{m.label}</dt>
                <dd>
                  <MetadataValueView m={m} />
                </dd>
              </div>
            ))}
          </dl>
        )}

        {b.images && b.images.length > 0 && (
          <div className="gallery">
            {b.images.map((src) => (
              <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                <img src={src} alt="" loading="lazy" />
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MetadataValueView({ m }: { m: MetadataValue }) {
  const url = safeUrl(m.value);
  if (m.type === 'url' && url)
    return (
      <a href={url} target="_blank" rel="noopener noreferrer nofollow">
        {url.replace(/^https?:\/\//, '')}
      </a>
    );
  if (m.type === 'phone') return <a href={`tel:${m.value.replace(/[^\d+]/g, '')}`}>{m.value}</a>;
  if (m.type === 'email') return <a href={`mailto:${m.value}`}>{m.value}</a>;
  return <span style={{ whiteSpace: 'pre-wrap' }}>{m.value}</span>;
}
