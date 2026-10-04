'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';
import type { Paged } from './types';

/**
 * Paged loading for infinite scroll. `key` resets the list (e.g. a new search
 * query); attach `sentinelRef` to an element at the end of the list and the
 * next page loads as it nears the viewport.
 */
export function useInfinite<T>(fetchPage: (page: number) => Promise<Paged<T>>, key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const loadMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const gen = generation.current;
    setLoading(true);
    try {
      const next = page + 1;
      const res = await fetchRef.current(next);
      if (gen !== generation.current) return; // a reset happened meanwhile
      setItems((prev) => (next === 1 ? res.items : [...prev, ...res.items]));
      setPage(next);
      setHasMore(res.hasMore);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      if (gen === generation.current) setError(errorMessage(e));
    } finally {
      if (gen === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [page]);

  // Reset whenever the key changes.
  useEffect(() => {
    generation.current++;
    busy.current = false;
    setItems([]);
    setPage(0);
    setHasMore(true);
    setTotal(null);
    setError(null);
  }, [key]);

  const observer = useRef<IntersectionObserver | null>(null);
  const loadRef = useRef(loadMore);
  loadRef.current = loadMore;
  const canLoad = hasMore && !error;
  const canLoadRef = useRef(canLoad);
  canLoadRef.current = canLoad;

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && canLoadRef.current) void loadRef.current();
      },
      { rootMargin: '900px 0px' },
    );
    observer.current.observe(node);
  }, []);

  // The observer only fires on changes, so keep filling while the sentinel stays visible.
  useEffect(() => {
    if (page === 0 && canLoad && !busy.current) void loadMore();
  }, [page, canLoad, loadMore]);

  useEffect(() => {
    if (!loading && canLoad && page > 0) {
      const node = document.querySelector('[data-sentinel]');
      if (node && node.getBoundingClientRect().top < window.innerHeight + 900) void loadMore();
    }
  }, [loading, canLoad, page, loadMore]);

  return { items, hasMore, loading, error, total, sentinelRef, retry: loadMore };
}
