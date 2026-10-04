'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { BrandDialog } from '@/components/BrandDialog';
import { BrandGrid } from '@/components/BrandGrid';
import { SearchResults } from '@/components/SearchResults';
import type { Brand } from '@/lib/types';

export function Home() {
  const query = (useSearchParams().get('q') ?? '').trim();
  const [open, setOpen] = useState<Brand | null>(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <main className="container page">
      <h1 className="sr-only">Pixel Directory</h1>
      {query ? <SearchResults key={query} query={query} onOpen={setOpen} /> : <BrandGrid onOpen={setOpen} />}
      <BrandDialog brand={open} onClose={close} />
    </main>
  );
}
