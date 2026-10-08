import { useState } from 'react';
import { certificates } from '../../api';
import { Certificate } from '../../types';
import { useCatalogPage } from './useCatalogPage';
import PageNavigation from './PageNavigation';
export default function CertificatePicker({
  farmId,
  value,
  onChange,
  disabled = false,
}: {
  farmId: string;
  value: string;
  onChange: (certificate: Certificate | null) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState(''),
    [selected, setSelected] = useState<Certificate | null>(null);
  const page = useCatalogPage(certificates.page, { farmId, status: 'active', search, limit: '50' });
  const choices =
    selected && selected.id === value && !page.items.some((c) => c.id === value)
      ? [selected, ...page.items]
      : page.items;
  return (
    <section aria-label="Attestation certificate selector" className="space-y-2">
      <p className="text-xs text-text-muted">
        Search recorded active certificates. Issuer, crop, dates and farm eligibility are checked
        when attesting.
      </p>
      <input
        aria-label="Search attestation certificates"
        maxLength={80}
        className="form-input"
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
      />
      {page.loading && <p role="status">Loading attestation certificates…</p>}
      {page.error && <p role="alert">Attestation certificates unavailable. {page.error}</p>}
      <select
        aria-label="Select attestation certificate"
        className="form-select"
        value={value}
        disabled={disabled || page.loading || Boolean(page.error)}
        onChange={(e) => {
          const certificate = choices.find((c) => c.id === e.target.value) || null;
          setSelected(certificate);
          onChange(certificate);
        }}
      >
        <option value="">Select certificate…</option>
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.standard} — {c.valid_from} to {c.valid_to}
          </option>
        ))}
      </select>
      {!page.loading && !page.error && !page.items.length && (
        <p>No active certificates match this farm and search.</p>
      )}
      <button
        type="button"
        className="btn"
        disabled={disabled || page.loading}
        onClick={page.refresh}
      >
        Retry attestation certificates
      </button>
      <PageNavigation
        label="attestation certificates"
        page={{ ...page, loading: page.loading || disabled }}
      />
    </section>
  );
}
