import { useDiscardChanges } from '../components/shared/UnsavedChanges';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';
import EvidenceReviewHistory from '../components/evidenceReview/EvidenceReviewHistory';
import { evidenceReview } from '../api/evidenceReview';
export default function EvidenceReviewPage() {
  const { user } = useAuthCtx();
  const discard = useDiscardChanges();
  const [params] = useSearchParams();
  const evidenceId = params.get('id');
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState('pending');
  const page = useCatalogPage(evidenceReview.page, {
    status,
    ...(evidenceId ? { id: evidenceId } : {}),
  });
  if (!user?.permissions.includes('*')) return <Navigate to="/home" replace />;
  return (
    <Layout currentPage="evidence-review">
      <section aria-label="Document review queue" className="space-y-4">
        <h2 className="text-xl font-bold">Document review queue</h2>
        <p>
          Review the actual retained file before recording a decision. This queue does not confer
          claim certification or document-release authority.
        </p>
        <label htmlFor="document-queue-status">Review status filter</label>
        <select
          id="document-queue-status"
          className="form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="btn" onClick={page.refresh}>
          Refresh review queue
        </button>
        {page.loading ? (
          <p role="status">Loading review queue…</p>
        ) : page.error ? (
          <p role="alert">Document review queue unavailable. {page.error}</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Review status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.file_name}</td>
                    <td>{row.review_status}</td>
                    <td>
                      <button
                        className="btn"
                        onClick={() => {
                          if (row.id !== selected) discard(() => setSelected(row.id));
                        }}
                      >
                        Review {row.file_name}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!page.items.length && <p>No documents match this review status on this page.</p>}
          </>
        )}
        <PageNavigation page={page} label="review queue" />
        {selected && (
          <>
            <button className="btn" onClick={() => discard(() => setSelected(''))}>
              Close document review
            </button>
            <EvidenceReviewHistory evidenceId={selected} reviewer onChanged={page.refresh} />
          </>
        )}
      </section>
    </Layout>
  );
}
