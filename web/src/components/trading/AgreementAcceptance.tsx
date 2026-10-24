import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/http';
interface AcceptanceState {
  schemaVersion: number;
  version: number;
  snapshotHash: string;
  yourRole: 'buyer' | 'seller';
  canAccept: boolean;
  snapshot: {
    scope: string;
    contractId: string;
    buyerOrganizationId: string;
    sellerOrganizationId: string;
    offerId: string;
    listingId: string;
    holdingId: string;
    quantityKg: string;
    pricePerKg: string;
    currency: string;
    incoterm: string;
    origin: string;
    destination: string;
  };
  acceptances: { buyer: string | null; seller: string | null };
}
export default function AgreementAcceptance({ contractId }: { contractId: string }) {
  const [opened, setOpened] = useState(false);
  const [data, setData] = useState<AcceptanceState | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const result = await api<AcceptanceState>('GET', `/contracts/${contractId}/acceptance`);
    setData(result);
    setError('');
    setConfirmed(false);
  }, [contractId]);
  useEffect(() => {
    setData(null);
    setOpened(false);
    setError('');
    setConfirmed(false);
  }, [contractId]);
  async function accept() {
    if (!data || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      setData(
        await api<AcceptanceState>('POST', `/contracts/${contractId}/acceptance`, {
          snapshotHash: data.snapshotHash,
          confirmed: true,
        }),
      );
      setConfirmed(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Acknowledgement failed';
      await refresh().catch(() => {});
      setError(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Agreement acknowledgement"
      className="bg-surface border border-border rounded p-5 space-y-3"
    >
      <h2 className="text-sm font-semibold">Review base commercial record</h2>
      {error && <p role="alert">{error}</p>}
      {!opened ? (
        <button
          className="btn text-xs"
          onClick={() => {
            setOpened(true);
            refresh().catch((error) => setError(error.message));
          }}
        >
          Review agreement version
        </button>
      ) : !data ? (
        error ? (
          <button
            className="btn"
            onClick={() => {
              refresh().catch((error) => setError(error.message));
            }}
          >
            Retry agreement
          </button>
        ) : (
          <p role="status">Loading commercial record…</p>
        )
      ) : (
        <>
          <p className="text-xs text-text-muted">
            {data.snapshot.scope} Recording this acknowledgement does not authorize payment or
            dispatch.
          </p>
          <p className="text-xs">
            Version {data.version} · schema {data.schemaVersion}
          </p>
          <dl className="text-xs grid grid-cols-2 gap-2">
            {Object.entries(data.snapshot)
              .filter(([key]) => key !== 'scope' && key !== 'schemaVersion')
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="font-semibold">
                    {(
                      {
                        contractId: 'Agreement record',
                        buyerOrganizationId: 'Buyer organization',
                        sellerOrganizationId: 'Seller organization',
                        offerId: 'Offer',
                        listingId: 'Archived listing',
                        holdingId: 'Holding',
                        quantityKg: 'Quantity (kg)',
                        pricePerKg: 'Price per kg',
                        currency: 'Currency',
                        incoterm: 'Incoterm',
                        origin: 'Origin',
                        destination: 'Destination',
                      } as Record<string, string>
                    )[key] ?? key}
                  </dt>
                  <dd className="break-all">{String(value ?? 'Not recorded')}</dd>
                </div>
              ))}
          </dl>
          <p className="text-xs break-all">Snapshot SHA-256: {data.snapshotHash}</p>
          {(['buyer', 'seller'] as const).map((party) => (
            <p className="text-xs" key={party}>
              {party === 'buyer' ? 'Buyer' : 'Seller'}:{' '}
              {data.acceptances[party]
                ? `Acknowledged ${new Date(data.acceptances[party]!).toLocaleString()}`
                : 'Awaiting acknowledgement'}
            </p>
          ))}
          {!data.acceptances[data.yourRole] && data.canAccept && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void accept();
              }}
              className="space-y-3"
            >
              <label className="flex gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  disabled={busy}
                />
                I reviewed this version of the base commercial record for my organization.
              </label>
              <button
                type="submit"
                className="btn btn-primary text-xs"
                disabled={!confirmed || busy}
              >
                Acknowledge reviewed version {data.version}
              </button>
            </form>
          )}
          {!data.canAccept && (
            <p className="text-xs">
              A team member with the appropriate trading permission can acknowledge this record.
            </p>
          )}
        </>
      )}
    </section>
  );
}
