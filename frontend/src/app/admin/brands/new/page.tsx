'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandForm } from '@/components/BrandForm';
import { RequireAuth } from '@/components/RequireAuth';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Brand, CardSize } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="brands.create">
      <NewBrand />
    </RequireAuth>
  );
}

function NewBrand() {
  const router = useRouter();
  const { can } = useAuth();
  const [sizes, setSizes] = useState<{ items: CardSize[]; currency: string } | null>(null);

  useEffect(() => {
    api.get<{ items: CardSize[]; currency: string }>('/admin/card-sizes').catch(() => api.get<{ items: CardSize[]; currency: string }>('/card-sizes')).then(setSizes);
  }, []);

  return (
    <div className="stack">
      <div className="row">
        <Link href="/admin/brands" className="muted small">
          ← Brands
        </Link>
      </div>
      <h1 className="page-title">New brand</h1>
      {sizes && (
        <BrandForm
          mode="admin"
          sizes={sizes.items}
          currency={sizes.currency}
          allow={{ resize: true, status: can('brands.status'), assign: can('brands.assign') }}
          submitLabel="Create brand"
          onSubmit={async (payload) => {
            const created = await api.post<Brand>('/admin/brands', payload);
            router.push(`/admin/brands/${created._id}`);
          }}
        />
      )}
    </div>
  );
}
