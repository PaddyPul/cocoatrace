import { useUnsavedChanges } from '../shared/UnsavedChanges';
import { useEffect, useState } from 'react';
import { api } from '../../api/http';
import type { SourcingRequest } from '../../domains/marketplace/types';
type Closeout = {
  status: string;
  reason: string;
  contract_id: string | null;
  association_basis: string | null;
  created_at: string;
};
export default function SourcingCloseout({
  request,
  onClosed,
}: {
  request: SourcingRequest;
  onClosed: (request: SourcingRequest) => void;
}) {
  const [record, setRecord] = useState<Closeout | null>(null),
    [loaded, setLoaded] = useState(false),
    [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<'closed' | 'awarded'>('closed'),
    [reason, setReason] = useState(''),
    [contract, setContract] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const clearUnsaved = useUnsavedChanges(
    !record && (reason !== '' || contract !== '' || status !== 'closed' || confirmed),
    'Sourcing closeout',
  );
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError('');
    api<{ closeout: Closeout | null }>('GET', `/sourcing-requests/${request.id}/closeout`)
      .then((result) => {
        if (active) {
          if (
            !result ||
            !Object.prototype.hasOwnProperty.call(result, 'closeout') ||
            (result.closeout !== null &&
              (typeof result.closeout.reason !== 'string' ||
                !['awarded', 'closed'].includes(result.closeout.status)))
          )
            throw new Error('Closeout record could not be verified. Reload to try again.');
          setRecord(result.closeout);
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [request.id, retry]);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const row = await api<SourcingRequest>('POST', `/sourcing-requests/${request.id}/closeout`, {
        status,
        reason,
        confirmed,
        ...(status === 'awarded' ? { contractId: contract.trim() } : {}),
      });
      clearUnsaved();
      setReason('');
      setContract('');
      setConfirmed(false);
      setStatus('closed');
      onClosed({ ...request, ...row });
      setRetry((value) => value + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Closeout failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-3xl border border-border bg-surface p-5">
      <h3 className="text-lg font-bold">Sourcing closeout</h3>
      <p className="mt-2 text-sm text-text-muted">
        Close manually after reviewing all supplier allocations. Accepting an offer does not close
        this request.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-red-300">
          {error}
        </p>
      )}
      {!loaded ? (
        <button className="btn mt-3" onClick={() => setRetry((value) => value + 1)}>
          Reload closeout record
        </button>
      ) : record ? (
        <div className="mt-3 space-y-2">
          <p>
            Status: {record.status} · {new Date(record.created_at).toLocaleString()}
          </p>
          <p className="whitespace-pre-wrap">{record.reason}</p>
          {record.contract_id && (
            <p>
              Buyer associated contract:{' '}
              <a className="underline" href={`/contracts/${record.contract_id}`}>
                {record.contract_id}
              </a>
              . This records a manual association, not proof of signature or full quantity
              fulfilment.
            </p>
          )}
        </div>
      ) : ['draft', 'open'].includes(request.status) ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            Outcome
            <select
              aria-label="Closeout outcome"
              className="form-select mt-1"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                setConfirmed(false);
              }}
            >
              <option value="closed">Close without award</option>
              <option value="awarded">Record manual award</option>
            </select>
          </label>
          {status === 'awarded' && (
            <div>
              <label htmlFor="closeout-contract" className="block">
                Existing buyer contract ID
              </label>
              <input
                id="closeout-contract"
                className="form-input mt-1"
                value={contract}
                onChange={(e) => {
                  setContract(e.target.value);
                  setConfirmed(false);
                }}
              />
              <span className="text-xs text-text-muted">
                Use a noncancelled contract for this buyer and commodity. You are explicitly
                associating it with this request; this does not claim signed terms or full
                fulfilment.
              </span>
            </div>
          )}
          <label className="block">
            Reason
            <textarea
              aria-label="Reason"
              className="form-input mt-1"
              minLength={10}
              maxLength={2000}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the allocations and any selected contract, and confirm this permanent
            closeout.
          </label>
          <button
            className="btn btn-primary"
            disabled={
              busy ||
              !confirmed ||
              reason.trim().length < 10 ||
              (status === 'awarded' && !contract.trim())
            }
            onClick={submit}
          >
            {busy ? 'Recording…' : 'Confirm permanent closeout'}
          </button>
        </div>
      ) : (
        <p className="mt-3">
          This request is {request.status}. No manual closeout record is available.
        </p>
      )}
    </section>
  );
}
