import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { certificates as certApi } from '../../api';
import { Farm } from '../../types';
import { StatusBadge, fmtDate } from '../shared/helpers';
import { useAuthCtx } from '../auth/AuthProvider';
import { useToast } from '../shared/ToastProvider';
import Layout from '../layout/Layout';
import { SkeletonTable } from '../shared/Skeleton';
import EmptyState from '../shared/EmptyState';
import FarmPicker from './FarmPicker';
import PageNavigation from './PageNavigation';
import { useCatalogPage } from './useCatalogPage';
import { Search, X } from 'lucide-react';
export default function CertificateRecordsPage() {
  const { canDo } = useAuthCtx();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedIssueFarm, setSelectedIssueFarm] = useState<Farm | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const page = useCatalogPage(certApi.page, { search, status, limit: '50' });
  const { items: certs, loading, error } = page;
  const [total, setTotal] = useState<number | null>(null);
  const [totalError, setTotalError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setTotal(null);
    setTotalError('');
    certApi
      .summary()
      .then((value) => {
        const counts = [
          value.count,
          value.active_count,
          value.suspended_count,
          value.revoked_count,
          value.expired_count,
        ];
        if (
          counts.some((n) => !Number.isSafeInteger(n) || n < 0) ||
          counts.slice(1).reduce((a, b) => a + b, 0) > value.count
        )
          throw new Error('Invalid certificate totals');
        if (active) setTotal(value.count);
      })
      .catch(() => {
        if (active) setTotalError('Certificate totals unavailable.');
      });
    return () => {
      active = false;
    };
  }, [version]);
  const refetch = () => {
    page.refresh();
    setVersion((v) => v + 1);
  };
  useEffect(() => {
    const refresh = () => {
      page.refresh();
      setVersion((v) => v + 1);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [page.refresh]);

  // Issue modal
  const [showIssue, setShowIssue] = useState(false);
  const [ifarmId, setIfarmId] = useState('');
  const [iStandard, setIStandard] = useState('EU_ORGANIC');
  const [iCropScope, setICropScope] = useState('cocoa');
  const [iValidFrom, setIValidFrom] = useState('');
  const [iValidTo, setIValidTo] = useState('');
  const [iAuthority, setIAuthority] = useState('');
  const [iAccred, setIAccred] = useState('');
  const [iLoading, setILoading] = useState(false);
  const [iError, setIError] = useState('');

  const handleIssue = async () => {
    if (!ifarmId || !iValidFrom || !iValidTo || !iAuthority || !iAccred) {
      setIError('All fields required');
      return;
    }
    setILoading(true);
    setIError('');
    try {
      const targetFarm = selectedIssueFarm;
      await certApi.issue({
        farmerOrganizationId: targetFarm?.farmer_organization_id || '',
        farmId: ifarmId,
        standard: iStandard,
        cropScope: iCropScope.split(',').map((s) => s.trim()),
        validFrom: iValidFrom,
        validTo: iValidTo,
        issuingAuthority: iAuthority,
        accreditationReference: iAccred,
      });
      setShowIssue(false);
      setIfarmId('');
      setIValidFrom('');
      setIValidTo('');
      setIAuthority('');
      setIAccred('');
      refetch();
      toast('success', 'Certificate issued');
    } catch (e: unknown) {
      setIError(e instanceof Error ? e.message : 'Certificate could not be issued');
    } finally {
      setILoading(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await certApi.updateStatus(id, action);
      refetch();
      toast('success', `Certificate ${action}ed`);
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Certificate status could not be changed');
    }
  };

  return (
    <Layout currentPage="certs">
      {totalError && (
        <p role="alert">
          {totalError}
          <button className="btn" onClick={refetch}>
            Retry certificate totals
          </button>
        </p>
      )}
      <p className="mb-3 text-xs text-text-muted">
        Status is the recorded certificate state. Dates, issuer accreditation and evidence are
        assessed separately for supply claims.
      </p>
      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : error ? (
        <div role="alert">
          {error}
          <button className="btn" onClick={refetch}>
            Retry certificates
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                aria-label="Search certificates"
                maxLength={80}
                placeholder="Search certificates…"
                className="form-input pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Certificate status"
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {['all', 'active', 'suspended', 'revoked', 'expired'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <div className="text-xs text-text-muted">
              {certs.length} on this page ·{' '}
              {total === null ? 'Total unavailable' : `${total} accessible certificates`}
            </div>
            {canDo('certificate.issue') && (
              <button className="btn btn-sm btn-primary" onClick={() => setShowIssue(true)}>
                + Issue Certificate
              </button>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th>Standard</th>
                <th>Certifier</th>
                <th>Farm</th>
                <th>Valid From</th>
                <th>Valid To</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {certs.length > 0 ? (
                certs.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-500/5">
                    <td className="text-text-primary font-medium">{c.standard}</td>
                    <td>{c.certifier_name || '—'}</td>
                    <td className="font-mono text-[11px]">{c.farm_id.slice(0, 8)}…</td>
                    <td className="text-[11px]">{fmtDate(c.valid_from)}</td>
                    <td className="text-[11px]">{fmtDate(c.valid_to)}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      {canDo('certificate.issue') && c.status === 'active' ? (
                        <div className="flex gap-1">
                          <button
                            className="btn btn-sm text-[10px] text-yellow-400 border-yellow-500/30"
                            onClick={() => handleAction(c.id, 'suspend')}
                          >
                            Suspend
                          </button>
                          <button
                            className="btn btn-sm text-[10px] text-red-400 border-red-500/30"
                            onClick={() => handleAction(c.id, 'revoke')}
                          >
                            Revoke
                          </button>
                        </div>
                      ) : canDo('certificate.issue') && c.status === 'suspended' ? (
                        <button
                          className="btn btn-sm text-[10px] text-green-400 border-green-500/30"
                          onClick={() => handleAction(c.id, 'reinstate')}
                        >
                          Reinstate
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm text-[10px]"
                          onClick={() => navigate(`/farms/${c.farm_id}`)}
                        >
                          View Farm
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : !search && status === 'all' ? (
                <tr>
                  <td colSpan={99}>
                    <EmptyState
                      icon="📋"
                      title="No certificates"
                      description="No certificate records are visible to this account. Recorded status does not establish accreditation or current validity."
                      action={
                        canDo('certificate.issue') ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setShowIssue(true)}
                          >
                            + Issue Certificate
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={99}>
                    <EmptyState
                      icon="🔍"
                      title="No certificates match"
                      description="Try adjusting your search."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <PageNavigation page={page} label="certificates" />
      {/* Issue Certificate Modal */}
      {showIssue && (
        <div className="modal-overlay" onClick={() => !iLoading && setShowIssue(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="modal-title">Issue Certificate</div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowIssue(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="form-label">Farm *</label>
                <FarmPicker
                  value={ifarmId}
                  disabled={iLoading}
                  onChange={(farm) => {
                    setSelectedIssueFarm(farm);
                    setIfarmId(farm?.id || '');
                  }}
                />
              </div>
              <div>
                <label className="form-label">Standard</label>
                <select
                  className="form-select"
                  value={iStandard}
                  onChange={(e) => setIStandard(e.target.value)}
                >
                  <option value="EU_ORGANIC">EU Organic</option>
                  <option value="USDA_ORGANIC">USDA Organic</option>
                  <option value="RAINFOREST_ALLIANCE">Rainforest Alliance</option>
                  <option value="FAIRTRADE">Fairtrade</option>
                  <option value="UTZ">UTZ</option>
                </select>
              </div>
              <div>
                <label className="form-label">Crop Scope</label>
                <input
                  className="form-input"
                  placeholder="cocoa, coffee…"
                  value={iCropScope}
                  onChange={(e) => setICropScope(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Valid From *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={iValidFrom}
                    onChange={(e) => setIValidFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Valid To *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={iValidTo}
                    onChange={(e) => setIValidTo(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Issuing Authority *</label>
                <input
                  className="form-input"
                  placeholder="e.g. OrganicCert GH"
                  value={iAuthority}
                  onChange={(e) => setIAuthority(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Accreditation Reference *</label>
                <input
                  className="form-input"
                  placeholder="e.g. OCG-GH-2026-001"
                  value={iAccred}
                  onChange={(e) => setIAccred(e.target.value)}
                />
              </div>
              {iError && (
                <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
                  {iError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  className="btn flex-1 justify-center"
                  onClick={() => setShowIssue(false)}
                  disabled={iLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary flex-1 justify-center"
                  onClick={handleIssue}
                  disabled={iLoading}
                >
                  {iLoading ? 'Issuing…' : 'Issue Certificate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
