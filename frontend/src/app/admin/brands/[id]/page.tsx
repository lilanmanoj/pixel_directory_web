'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandForm } from '@/components/BrandForm';
import { BrandMetricsCard } from '@/components/BrandMetricsCard';
import { RequireAuth } from '@/components/RequireAuth';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { number } from '@/lib/format';
import type { Brand, CardSize } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="brands.read">
      <EditBrand />
    </RequireAuth>
  );
}

function EditBrand() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const [toast, show] = useToast();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [sizes, setSizes] = useState<{ items: CardSize[]; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api.get<Brand>(`/admin/brands/${id}`).then(setBrand).catch((e) => setError(errorMessage(e)));
    // Admins see inactive tiers too; others fall back to the public list.
    api
      .get<{ items: CardSize[]; currency: string }>('/admin/card-sizes')
      .catch(() => api.get<{ items: CardSize[]; currency: string }>('/card-sizes'))
      .then(setSizes)
      .catch(() => undefined);
  }, [id]);

  const remove = async () => {
    if (!brand || !confirm(`Delete “${brand.name}”? It will disappear from the directory and admin lists.`)) return;
    try {
      await api.del(`/admin/brands/${id}`);
      router.push('/admin/brands');
    } catch (e) {
      show(errorMessage(e), true);
    }
  };

  if (error) return <div className="alert">{error}</div>;
  if (!brand || !sizes) return <div className="empty">Loading…</div>;

  return (
    <div className="stack">
      <Link href="/admin/brands" className="muted small">
        ← Brands
      </Link>
      <div className="row-between">
        <div>
          <h1 className="page-title">{brand.name}</h1>
          <p className="muted small" style={{ margin: 0 }}>
            /{brand.slug} · {brand.active ? 'Active' : 'Inactive'} · {number(brand.clickCount ?? 0)} clicks all time
          </p>
        </div>
        {can('brands.delete') && (
          <button className="btn btn-danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>

      {can('metrics.view') && <BrandMetricsCard id={id} />}

      <BrandForm
        key={version}
        mode="admin"
        initial={brand}
        sizes={sizes.items}
        currency={sizes.currency}
        allow={{
          content: can('brands.update'),
          resize: can('brands.resize'),
          status: can('brands.status'),
          assign: can('brands.assign'),
        }}
        submitLabel="Save changes"
        onSubmit={async (payload) => {
          const updated = await api.patch<Brand>(`/admin/brands/${id}`, payload);
          setBrand(updated);
          setVersion((v) => v + 1);
          show('Saved');
        }}
      />
      {toast}
    </div>
  );
}
