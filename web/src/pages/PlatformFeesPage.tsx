import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import FeeStatement, { downloadJson } from '../components/fees/FeeStatement';
import { platformFees, type FeeStatement as Statement, type FeeReconciliation } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { fmtMoney } from '../components/shared/helpers';
export default function PlatformFeesPage() {
  const { id } = useParams(),
    { canDo } = useAuthCtx();
  const [rows, setRows] = useState<Statement['fee'][]>([]),
    [error, setError] = useState(''),
    [report, setReport] = useState<FeeReconciliation | null>(null);
  const [loading, setLoading] = useState(!id);
  const [retry, setRetry] = useState(0);
  const [reportError, setReportError] = useState('');
  const [reconciling, setReconciling] = useState(false);
  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(true);
      setError('');
      setRows([]);

      platformFees
        .list()
        .then((value) => {
          if (
            !Array.isArray(value) ||
            value.some(
              (row) =>
                !row ||
                typeof row.id !== 'string' ||
                typeof row.contract_id !== 'string' ||
                typeof row.status !== 'string' ||
                typeof row.currency !== 'string' ||
                !Number.isFinite(Number(row.amount_total)),
            )
          )
            throw new Error('Invalid fee register response. Retry the register.');
          if (active) setRows(value);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [id, retry]);
  const reconcile = async () => {
    setReconciling(true);
    setReport(null);
    setReportError('');
    try {
      const value = await platformFees.reconcile();
      setReport(value);
      setReportError('');
      downloadJson('cocoatrace-fee-reconciliation.json', value);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };
  return (
    <Layout currentPage="platform-fees">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Platform fees</h1>
        <p className="text-xs text-text-muted">
          Commercial fee statements are separate from goods payments. Tax treatment and external
          collection channels need platform agreement.
        </p>
        {error && (
          <p role="alert">
            {error}{' '}
            <button className="btn" onClick={() => setRetry((value) => value + 1)}>
              Retry fee register
            </button>
          </p>
        )}
        {reportError && <p role="alert">{reportError}</p>}
        {id ? (
          <FeeStatement contractId={id} />
        ) : (
          <>
            {canDo('finance.manage') && (
              <button className="btn" disabled={reconciling} onClick={() => void reconcile()}>
                Reconcile and export fee ledger
              </button>
            )}
            {report && (
              <div role="status">
                <p>
                  {report.ok
                    ? 'Fee ledger checks passed'
                    : `${report.issues.length} fee discrepancies require review`}
                </p>
                {report.issues.map((i) => (
                  <p key={`${i.code}:${i.contract_id}`} className="text-xs">
                    {i.code}: {i.fee_id}
                  </p>
                ))}
                {report.limitations.map((l) => (
                  <p key={l} className="text-xs text-text-muted">
                    {l}
                  </p>
                ))}
              </div>
            )}
            {loading && <p role="status">Loading fee register…</p>}
            {!loading && !rows.length && !error && (
              <p>
                No fee statements for your organization yet. A fee estimate is created when an offer
                is accepted.
              </p>
            )}
            <p className="text-xs text-text-muted">
              Latest 200 statements. Finance reconciliation checks the full ledger.
            </p>
            <div className="space-y-2">
              {rows.map((f) => (
                <Link
                  className="block border border-border rounded p-3"
                  key={f.id}
                  to={`/platform-fees/${f.contract_id}`}
                >
                  <span>
                    {f.seller_name} → {f.buyer_name}
                  </span>
                  <span className="block text-xs">
                    {fmtMoney(Number(f.amount_total), f.currency, f.currency_minor_units)} ·{' '}
                    {f.refund_status === 'confirmed'
                      ? 'Full fee refund confirmed · original paid receipt retained'
                      : f.refund_status
                        ? `Refund ${f.refund_status} · trade on hold`
                        : f.status.split('_').join(' ')}{' '}
                    · {f.contract_id}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
