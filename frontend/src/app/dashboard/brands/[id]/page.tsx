'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BrandForm } from '@/components/BrandForm';
import { BrandMetricsCard } from '@/components/BrandMetricsCard';
import { RequireAuth } from '@/components/RequireAuth';
import { SizePicker } from '@/components/SizePicker';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import type { Brand, CardSize } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="own-brands.read">
      <EditMyBrand />
    </RequireAuth>
  );
}

function EditMyBrand() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [toast, show] = useToast();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    api.get<Brand>(`/my/brands/${id}`).then(setBrand).catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <div className="alert">{error}</div>;
  if (!brand) return <div className="empty">Loading…</div>;

  return (
    <div className="stack">
      <Link href="/dashboard" className="muted small">
        ← My brands
      </Link>
      <div>
        <h1 className="page-title">{brand.name}</h1>
        <p className="muted small" style={{ margin: 0 }}>
          {brand.active ? 'Live on the directory' : 'Hidden by an administrator'} · changes go live as soon as you save
        </p>
      </div>

      {can('payments.create') && <UpgradeCard key={brand.cardSize._id} brand={brand} onChanged={load} />}
      {can('own-brands.metrics') && <BrandMetricsCard id={id} base="/my/brands" />}

      {can('own-brands.update') ? (
        <BrandForm
          key={version}
          mode="owner"
          initial={brand}
          submitLabel="Save changes"
          onSubmit={async (payload) => {
            const updated = await api.patch<Brand>(`/my/brands/${id}`, payload);
            setBrand(updated);
            setVersion((v) => v + 1);
            show('Saved');
          }}
        />
      ) : (
        <p className="muted">Your role can view but not edit this brand.</p>
      )}
      {toast}
    </div>
  );
}

/** Owners change size through checkout; they pay the difference when moving to a pricier tier. */
function UpgradeCard({ brand, onChanged }: { brand: Brand; onChanged: () => void }) {
  const router = useRouter();
  const [sizes, setSizes] = useState<{ items: CardSize[]; currency: string } | null>(null);
  const [target, setTarget] = useState(brand.cardSize._id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    api.get<{ items: CardSize[]; currency: string }>('/card-sizes').then(setSizes).catch(() => undefined);
  }, []);

  if (!sizes) return null;
  const currentPrice = brand.cardSize.price ?? 0;
  const cost = (s: CardSize) => Math.max(0, (s.price ?? 0) - currentPrice);
  const selected = sizes.items.find((s) => s._id === target);
  const isCurrent = target === brand.cardSize._id;

  const go = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.post<{ status: 'applied' | 'pending'; checkoutUrl?: string }>('/payments/checkout', {
        brandId: brand._id,
        cardSizeId: target,
      });
      if (res.status === 'pending' && res.checkoutUrl) router.push(res.checkoutUrl);
      else onChanged();
    } catch (e) {
      setMessage({ text: errorMessage(e), ok: false });
      setBusy(false);
    }
  };

  return (
    <section className="glass card stack">
      <div>
        <h2 style={{ fontSize: 18 }}>Card size</h2>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          Currently <strong>{brand.cardSize.name}</strong>. Bigger cards stand out on the wall — you pay only the
          difference between tiers.
        </p>
      </div>
      <SizePicker
        sizes={sizes.items}
        value={target}
        onChange={setTarget}
        priceLabel={(s) =>
          s._id === brand.cardSize._id ? 'Current' : cost(s) > 0 ? `+${money(cost(s), sizes.currency)}` : 'Free change'
        }
      />
      {message && <div className={`alert ${message.ok ? 'alert-success' : ''}`}>{message.text}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={isCurrent || busy || !selected} onClick={go}>
          {isCurrent || !selected
            ? 'Choose a new size'
            : cost(selected) > 0
              ? `Upgrade to ${selected.name} · ${money(cost(selected), sizes.currency)}`
              : `Switch to ${selected.name}`}
        </button>
      </div>
    </section>
  );
}
