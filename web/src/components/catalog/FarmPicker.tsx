import { useState } from 'react';
import { farms } from '../../api';
import { Farm } from '../../types';
import { useCatalogPage } from './useCatalogPage';
import PageNavigation from './PageNavigation';
export default function FarmPicker({
  value,
  onChange,
  owned = false,
  disabled = false,
}: {
  value: string;
  onChange: (farm: Farm | null) => void;
  owned?: boolean;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Farm | null>(null);
  const page = useCatalogPage(farms.page, { search, owned: String(owned) });
  const choices =
    selected && selected.id === value && !page.items.some((row) => row.id === value)
      ? [selected, ...page.items]
      : page.items;
  return (
    <section aria-label="Source farm selector" className="space-y-2">
      <input
        aria-label="Search source farms"
        maxLength={80}
        className="form-input"
        placeholder="Search farm name, region or exact ID"
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
      />
      {page.loading && <p role="status">Loading source farms…</p>}
      {page.error && <p role="alert">Source farms could not be loaded. {page.error}</p>}
      <select
        aria-label="Select source farm"
        className="form-select"
        value={value}
        disabled={disabled || page.loading || Boolean(page.error)}
        onChange={(e) => {
          const farm = choices.find((row) => row.id === e.target.value) || null;
          setSelected(farm);
          onChange(farm);
        }}
      >
        <option value="">Select farm *</option>
        {choices.map((farm) => (
          <option key={farm.id} value={farm.id}>
            {farm.name} — {farm.region}
          </option>
        ))}
      </select>
      {!page.loading && !page.error && !page.items.length && (
        <p role="status">No farms match this page and search.</p>
      )}
      <button
        type="button"
        className="btn btn-sm"
        disabled={disabled || page.loading}
        onClick={page.refresh}
      >
        Retry source farms
      </button>
      <PageNavigation label="source farms" page={{ ...page, loading: page.loading || disabled }} />
    </section>
  );
}
