import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import FeeStatement, { downloadJson } from '../components/fees/FeeStatement';
import { platformFees, type FeeReconciliation } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import FeeRegister from '../components/fees/FeeRegister';
export default function PlatformFeesPage() {
  const { id } = useParams(),
    { canDo } = useAuthCtx();
  const [report, setReport] = useState<FeeReconciliation | null>(null);
  const [reportError, setReportError] = useState('');
  const [reconciling, setReconciling] = useState(false);
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
            <FeeRegister />
          </>
        )}
      </div>
    </Layout>
  );
}
