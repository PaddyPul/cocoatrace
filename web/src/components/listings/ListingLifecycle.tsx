import { useUnsavedChanges, useDiscardChanges } from '../shared/UnsavedChanges';
import { useState } from 'react';
import type { Listing } from '../../domains/marketplace/types';
import { listings } from '../../api';
export default function ListingLifecycle({
  listing,
  owner,
  onRenew,
}: {
  listing: Listing;
  owner: boolean;
  onRenew: () => void;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [days, setDays] = useState(30),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = open && (reason !== '' || days !== 30);
  const clearUnsaved = useUnsavedChanges(dirty, 'Listing renewal');
  const discard = useDiscardChanges(dirty);
  const close = () =>
    discard(() => {
      setOpen(false);
      setReason('');
      setDays(30);
    });
  const expired = !!listing.expires_at && new Date(listing.expires_at).getTime() <= Date.now();
  async function renew() {
    setBusy(true);
    setError('');
    try {
      await listings.renew(listing.id, {
        expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
        reason,
      });
      clearUnsaved();
      setReason('');
      setDays(30);
      setOpen(false);
      onRenew();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Renewal failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 text-xs">
      <p>
        {expired ? 'Expired' : listing.expires_at ? 'Expires' : 'Legacy listing: no expiry'}
        {listing.expires_at ? ` · ${new Date(listing.expires_at).toLocaleString()}` : ''}
      </p>
      {owner && listing.active !== false && !listing.activeRecall && (
        <button className="btn btn-sm" onClick={() => (open ? close() : setOpen(true))}>
          Review and renew
        </button>
      )}
      {open && (
        <div className="space-y-2 border border-border p-2">
          <p>
            Confirm the displayed quantity and terms are still available. Renewal rejects all
            pending offers; buyers must submit new offers.
          </p>
          <label>
            Days until reviewed expiry
            <input
              aria-label="Days until reviewed expiry"
              className="form-input"
              type="number"
              min="1"
              max="90"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <label>
            Renewal reason
            <textarea
              aria-label="Renewal reason"
              className="form-input"
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-red-400">
              {error}
            </p>
          )}
          <button
            className="btn btn-primary"
            disabled={busy || reason.trim().length < 10 || days < 1 || days > 90}
            onClick={renew}
          >
            {busy ? 'Renewing…' : 'Confirm renewal'}
          </button>
          <button className="btn ml-2" disabled={busy} onClick={close}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
