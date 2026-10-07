import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { evidence } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import { StatusBadge } from '../components/shared/helpers';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';

export default function EvidenceRecordsPage() {
  const { canDo } = useAuthCtx();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const entityType = params.get('entityType'),
    entityId = params.get('entityId');
  const page = useCatalogPage(evidence.page, {
    search,
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
  });
  return (
    <Layout currentPage="evidence">
      <section className="table-wrap space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex-1 min-w-[180px]">
            Search evidence
            <input
              aria-label="Search evidence"
              maxLength={80}
              className="form-input mt-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="File, type, linked record or review status"
            />
          </label>
          <p className="text-xs text-text-muted">
            {page.items.length} {page.items.length === 1 ? 'file' : 'files'} on this page
          </p>
          {canDo('evidence.upload') && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => navigate('/evidence/contribute')}
            >
              + Upload
            </button>
          )}
        </div>
        {entityType && entityId && (
          <p className="text-xs text-text-muted">
            Evidence for {entityType} / {entityId}
          </p>
        )}
        <p className="text-xs text-text-muted">
          Document review and malware scanning are separate. Being listed does not approve a claim
          or authorize release of protected trade documents.
        </p>
        {page.loading ? (
          <p role="status">Loading evidence…</p>
        ) : page.error ? (
          <div role="alert">
            <p>Evidence could not be loaded. {page.error}</p>
            <button className="btn btn-sm mt-2" onClick={page.refresh}>
              Retry evidence
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>SHA-256</th>
                <th>Linked Entity</th>
                <th>Review</th>
                <th>Scan</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.file_name}</td>
                  <td>{(item.type || '').replace(/_/g, ' ')}</td>
                  <td className="font-mono text-[10px] max-w-[200px] truncate">
                    {item.sha256_hash}
                  </td>
                  <td className="font-mono text-[10px]">
                    {item.linked_entity_type}/{item.linked_entity_id.slice(0, 8)}…
                  </td>
                  <td>
                    <StatusBadge status={item.review_status} />
                  </td>
                  <td>{(item.malware_scan_status || 'Unknown').replace(/_/g, ' ')}</td>
                  <td className="text-[11px]">{new Date(item.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!page.loading && !page.error && !page.items.length && (
          <p role="status">
            {search || page.hasPrevious || entityType
              ? 'No evidence matches this page and search. Change the search or return to the previous page.'
              : 'No evidence uploaded. Choose an actual record and explain the claim before attaching a document.'}
          </p>
        )}
        <PageNavigation label="evidence" page={page} />
      </section>
    </Layout>
  );
}
