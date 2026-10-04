'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { SizeGlyph } from '@/components/SizePicker';
import { api, errorMessage } from '@/lib/api';
import { money, statusChip } from '@/lib/format';
import type { Payment } from '@/lib/types';

export default function Page() {
  return (
    <RequireAuth permission="payments.create">
      <Checkout />
    </RequireAuth>
  );
}

/** Checkout for the built-in mock gateway. A real provider would redirect to its hosted page instead. */
function Checkout() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Payment>(`/payments/${id}`).then(setPayment).catch((e) => setError(errorMessage(e)));
  }, [id]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setPayment(await api.post<Payment>(`/payments/${id}/confirm`, { cardNumber: card }));
    } catch (err) {
      setError(errorMessage(err));
      api.get<Payment>(`/payments/${id}`).then(setPayment).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await api.post(`/payments/${id}/cancel`).catch(() => undefined);
    router.push(payment?.brand ? `/dashboard/brands/${payment.brand._id}` : '/dashboard');
  };

  if (!payment) return error ? <div className="alert">{error}</div> : <div className="empty">Loading…</div>;

  return (
    <div className="auth-wrap" style={{ minHeight: 'auto' }}>
      <div className="auth-card glass stack">
        <div className="row-between">
          <h1 className="page-title">Checkout</h1>
          <span className={`chip ${statusChip[payment.status]}`}>{payment.status}</span>
        </div>
        <div className="glass" style={{ padding: 14, boxShadow: 'none' }}>
          <div className="muted small">{payment.brand?.name}</div>
          <div className="row" style={{ marginTop: 6 }}>
            {payment.fromSize && <SizeGlyph colSpan={payment.fromSize.colSpan} rowSpan={payment.fromSize.rowSpan} />}
            <span>{payment.fromSize?.name}</span>
            <span className="muted">→</span>
            {payment.toSize && <SizeGlyph colSpan={payment.toSize.colSpan} rowSpan={payment.toSize.rowSpan} />}
            <strong>{payment.toSize?.name}</strong>
          </div>
          <div className="stat-value" style={{ marginTop: 8 }}>
            {money(payment.amount, payment.currency)}
          </div>
        </div>

        {payment.status === 'paid' ? (
          <>
            <div className="alert alert-success">Payment received — your card is now {payment.toSize?.name}.</div>
            <Link className="btn btn-primary" href={payment.brand ? `/dashboard/brands/${payment.brand._id}` : '/dashboard'}>
              Back to brand
            </Link>
          </>
        ) : payment.status === 'pending' ? (
          <form className="stack" onSubmit={pay}>
            <div className="alert" style={{ color: 'var(--warning)', borderColor: 'currentColor', background: 'transparent' }}>
              Test mode: no real money moves. Use 4000 0000 0000 0002 to simulate a decline.
            </div>
            <label className="field">
              <span>Card number</span>
              <input className="input" inputMode="numeric" autoComplete="off" value={card} onChange={(e) => setCard(e.target.value)} />
            </label>
            {error && <div className="alert">{error}</div>}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Processing…' : `Pay ${money(payment.amount, payment.currency)}`}
            </button>
            <button type="button" className="btn" onClick={cancel}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            {error && <div className="alert">{error}</div>}
            <p className="muted" style={{ margin: 0 }}>
              This payment is {payment.status}. Start a new upgrade from the brand page.
            </p>
            <Link className="btn" href={payment.brand ? `/dashboard/brands/${payment.brand._id}` : '/dashboard'}>
              Back to brand
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
