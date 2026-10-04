'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  size?: 'md' | 'sm';
  children: React.ReactNode;
}

/** Glass modal: closes on Escape or backdrop click, locks page scroll, restores focus. */
export function Dialog({ open, onClose, label, size = 'md', children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        className={`dialog glass ${size === 'sm' ? 'dialog-sm' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <button type="button" className="btn btn-icon dialog-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
