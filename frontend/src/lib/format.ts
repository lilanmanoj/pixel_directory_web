import type { Payment } from './types';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Two-tone gradient from a brand's accent colour, used when it has no image. */
export const accentGradient = (accent = '#7c8cff') =>
  `radial-gradient(120% 120% at 0% 0%, ${accent} 0%, transparent 60%), linear-gradient(135deg, ${accent}cc, #1b1f3a)`;

export const money = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

export const number = (n: number) => new Intl.NumberFormat().format(n);

export const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export const dateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

/** Only http(s) links are ever rendered as hrefs. */
export const safeUrl = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : undefined);

export const statusChip: Record<Payment['status'], string> = {
  paid: 'chip-success',
  pending: 'chip-warning',
  failed: 'chip-danger',
  cancelled: '',
};
