import { useCallback, useRef, useState } from 'react';
import { organizations, type OrganizationRecord, type OrganizationMember } from '../api';
import Layout from '../components/layout/Layout';
import PageNavigation from '../components/catalog/PageNavigation';
import { useCatalogPage } from '../components/catalog/useCatalogPage';

function countValid(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}
function workspaceAccess(status: string | null | undefined) {
  const labels: Record<string, string> = {
    verified: 'Workspace approved',
    pending: 'Approval pending',
    pending_review: 'Approval pending',
    unverified: 'Approval pending',
    suspended: 'Workspace suspended',
    rejected: 'Approval rejected',
    inactive: 'Workspace inactive',
  };
  return status ? labels[status] || 'Access status unavailable' : 'Access status unavailable';
}
function Members({ organization, close }: { organization: OrganizationRecord; close: () => void }) {
  const [search, setSearch] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [totalsError, setTotalsError] = useState('');
  const version = useRef(0);
  const fetch = useCallback(
    async (parameters: Record<string, string>) => {
      const current = ++version.current;
      const [result, summary] = await Promise.all([
        organizations.membersPage(organization.id, parameters),
        organizations.membersSummary(organization.id).catch(() => null),
      ]);
      if (
        !result ||
        !countValid(result.count) ||
        !Array.isArray(result.items) ||
        result.items.length > 100 ||
        result.count < result.items.length ||
        result.items.some(
          (row) =>
            !row ||
            typeof row.id !== 'string' ||
            typeof row.email !== 'string' ||
            !(row.name === null || row.name === undefined || typeof row.name === 'string') ||
            !Array.isArray(row.roles) ||
            row.roles.some((role) => typeof role !== 'string'),
        )
      )
        throw new Error('Invalid member page response.');
      if (current === version.current) {
        const valid = summary && countValid(summary.count);
        setCount(valid ? summary.count : null);
        setTotalsError(valid ? '' : 'Full totals unavailable. Retry to refresh.');
      }
      return result;
    },
    [organization.id],
  );
  const page = useCatalogPage<OrganizationMember>(fetch, { limit: '50', search });
  return (
    <div className="modal-overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${organization.name} members`}
        className="modal"
      >
        <div className="flex justify-between">
          <h2>{organization.name} — Members</h2>
          <button className="btn" onClick={close}>
            Close members
          </button>
        </div>
        <p>{count === null ? 'Total unavailable' : `${count.toLocaleString()} members`}</p>
        {totalsError && (
          <div role="alert">
            {totalsError}
            <button onClick={page.refresh}>Retry member totals</button>
          </div>
        )}
        <input
          className="form-input"
          aria-label="Search members"
          maxLength={80}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {page.loading ? (
          <p role="status">Loading members…</p>
        ) : page.error ? (
          <div role="alert">
            {page.error}
            <button onClick={page.refresh}>Retry members</button>
          </div>
        ) : page.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Roles</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((member) => (
                <tr key={member.id}>
                  <td>{member.email}</td>
                  <td>{member.name || '—'}</td>
                  <td>{member.roles.join(', ') || 'No roles assigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{search ? 'No members match this search.' : 'No members recorded.'}</p>
        )}
        <PageNavigation page={page} label="members" />
      </section>
    </div>
  );
}
export default function OrganizationsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OrganizationRecord | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [totalsError, setTotalsError] = useState('');
  const version = useRef(0);
  const fetch = useCallback(async (parameters: Record<string, string>) => {
    const current = ++version.current;
    const [result, summary] = await Promise.all([
      organizations.page(parameters),
      organizations.summary().catch(() => null),
    ]);
    if (
      !result ||
      !countValid(result.count) ||
      !Array.isArray(result.items) ||
      result.items.length > 100 ||
      result.count < result.items.length ||
      result.items.some(
        (row) =>
          !row ||
          typeof row.id !== 'string' ||
          typeof row.name !== 'string' ||
          typeof row.type !== 'string' ||
          !(
            row.verification_status === undefined ||
            row.verification_status === null ||
            typeof row.verification_status === 'string'
          ) ||
          !(
            row.jurisdiction === null ||
            row.jurisdiction === undefined ||
            typeof row.jurisdiction === 'string'
          ),
      )
    )
      throw new Error('Invalid organization page response.');
    if (current === version.current) {
      const valid = summary && countValid(summary.count);
      setCount(valid ? summary.count : null);
      setTotalsError(valid ? '' : 'Full totals unavailable. Retry to refresh.');
    }
    return result;
  }, []);
  const page = useCatalogPage<OrganizationRecord>(fetch, { limit: '50', search });
  return (
    <Layout currentPage="organizations">
      <section aria-label="Organization register" className="table-wrap space-y-3">
        <h2>
          Organizations — {count === null ? 'total unavailable' : count.toLocaleString()} recorded
        </h2>
        {totalsError && (
          <div role="alert">
            {totalsError}
            <button onClick={page.refresh}>Retry organization totals</button>
          </div>
        )}
        <p className="text-xs">
          Totals cover all organizations you can access. Search applies before pagination.
        </p>
        <input
          className="form-input"
          aria-label="Search organizations"
          maxLength={80}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {page.loading ? (
          <p role="status">Loading organizations…</p>
        ) : page.error ? (
          <div role="alert">
            {page.error}
            <button onClick={page.refresh}>Retry organizations</button>
          </div>
        ) : page.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Jurisdiction</th>
                <th>Workspace access</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((org) => (
                <tr key={org.id}>
                  <td>{org.name}</td>
                  <td>{org.type}</td>
                  <td>{org.jurisdiction || '—'}</td>
                  <td>{workspaceAccess(org.verification_status)}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setSelected(org)}>
                      Members →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{search ? 'No organizations match this search.' : 'No organizations recorded.'}</p>
        )}
        <PageNavigation page={page} label="organizations" />
      </section>
      {selected && (
        <Members key={selected.id} organization={selected} close={() => setSelected(null)} />
      )}
    </Layout>
  );
}
