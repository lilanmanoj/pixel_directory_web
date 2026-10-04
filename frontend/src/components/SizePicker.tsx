'use client';

import { money } from '@/lib/format';
import type { CardSize } from '@/lib/types';

export function SizeGlyph({ colSpan, rowSpan }: { colSpan: number; rowSpan: number }) {
  return (
    <span className="size-glyph" aria-hidden>
      {Array.from({ length: 4 * Math.max(2, rowSpan) }, (_, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return <i key={i} className={col < colSpan && row < rowSpan ? 'on' : ''} />;
      })}
    </span>
  );
}

/** Choose a card size; shows each tier's footprint and price. */
export function SizePicker({
  sizes,
  value,
  onChange,
  currency,
  priceLabel,
}: {
  sizes: CardSize[];
  value: string;
  onChange: (id: string) => void;
  currency?: string;
  /** Override what is shown under each size (e.g. the upgrade cost). */
  priceLabel?: (size: CardSize) => string;
}) {
  return (
    <div className="size-picker" role="group" aria-label="Card size">
      {sizes.map((s) => (
        <button
          key={s._id}
          type="button"
          className="size-option"
          aria-pressed={value === s._id}
          onClick={() => onChange(s._id)}
        >
          <SizeGlyph colSpan={s.colSpan} rowSpan={s.rowSpan} />
          <span>
            <strong>{s.name}</strong>
            <span className="muted small" style={{ display: 'block' }}>
              {s.colSpan}×{s.rowSpan} ·{' '}
              {priceLabel ? priceLabel(s) : s.price ? money(s.price, currency) : 'Free'}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
