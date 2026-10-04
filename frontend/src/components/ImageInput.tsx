'use client';

import { useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { UploadIcon } from './icons';

/** Image URL field with an upload button and a small preview. */
export function ImageInput({
  label,
  value,
  onChange,
  aspect = '1',
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: string;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      onChange((await api.upload(f)).url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  return (
    <div className="field">
      <span>{label}</span>
      <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
        <div
          className="glass"
          style={{
            width: 64,
            flex: 'none',
            aspectRatio: aspect,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: 'none',
            alignSelf: 'center',
          }}
        >
          {value && <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div className="stack grow" style={{ gap: 6 }}>
          <input
            className="input"
            placeholder="https://… or upload"
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
          />
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => file.current?.click()}>
              <UploadIcon size={14} /> {busy ? 'Uploading…' : 'Upload'}
            </button>
            {value && (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange('')}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        hidden
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {error && <small style={{ color: 'var(--danger)' }}>{error}</small>}
    </div>
  );
}
