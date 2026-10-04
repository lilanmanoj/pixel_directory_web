'use client';

import { useCallback, useEffect, useState } from 'react';

/** Minimal transient message: `const [toast, show] = useToast(); show('Saved'); … {toast}` */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  const show = useCallback((text: string, error = false) => setMsg({ text, error }), []);
  const node = msg ? (
    <div className={`toast glass glass-strong ${msg.error ? 'alert' : ''}`} role="status">
      {msg.text}
    </div>
  ) : null;
  return [node, show] as const;
}
