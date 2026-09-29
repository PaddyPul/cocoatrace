import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, PackagePlus, ShieldAlert } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { batches } from '../api';
import { useToast } from '../components/shared/ToastProvider';

export default function DirectInventoryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ commodity: '', quantityKg: '', inventoryDate: new Date().toISOString().slice(0, 10), sourceName: '', sourceCountry: 'GH', sourceRegion: '', warehouseLocation: '', grade: '', moisturePercent: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = (name: keyof typeof form) => ({ value: form[name], onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [name]: event.target.value })) });
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await batches.createDirectInventory({ commodity: form.commodity, quantityKg: Number(form.quantityKg), inventoryDate: form.inventoryDate, sourceName: form.sourceName || undefined, sourceCountry: form.sourceCountry, sourceRegion: form.sourceRegion || undefined, warehouseLocation: form.warehouseLocation || undefined, grade: form.grade || undefined, moisturePercent: form.moisturePercent ? Number(form.moisturePercent) : undefined });
      toast('success', 'Conventional inventory recorded. It is ready for commercial listing.');
      navigate('/supply/new');
    } catch (err: any) { setError(err.message || 'Could not create inventory'); } finally { setBusy(false); }
  };
  return <Layout currentPage="inventory-new" actions={<button className="btn" onClick={() => navigate('/home?mode=sell')}><ArrowLeft size={14} />Back</button>}>
    <section className="mx-auto max-w-4xl"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-400">Conventional supply path</div><h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">Record inventory without creating a farm.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">Use this for conventional material you hold. Record its declared commercial origin and warehouse details. Farm-level or organic claims are intentionally not added.</p>
      <div className="mt-6 flex gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4 text-xs leading-5 text-text-secondary"><ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-300" /><span>This path creates a supplier-declared inventory record. Buyers will see that field-level provenance and organic certification are not claimed.</span></div>
      <div className="mt-5 rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Commodity or material"><input className="form-input" placeholder="e.g. shea nuts, copper concentrate" {...field('commodity')} /></Field><Field label="Quantity (kg)"><input className="form-input" type="number" min="0" {...field('quantityKg')} /></Field><Field label="Inventory date"><input className="form-input" type="date" {...field('inventoryDate')} /></Field><Field label="Country of origin (ISO code)"><input className="form-input uppercase" maxLength={2} {...field('sourceCountry')} /></Field><Field label="Declared source or supplier"><input className="form-input" placeholder="Optional" {...field('sourceName')} /></Field><Field label="Region"><input className="form-input" placeholder="Optional" {...field('sourceRegion')} /></Field><Field label="Warehouse location"><input className="form-input" placeholder="Optional" {...field('warehouseLocation')} /></Field><Field label="Grade"><input className="form-input" placeholder="Optional" {...field('grade')} /></Field><Field label="Moisture (%)"><input className="form-input" type="number" step="0.1" min="0" max="100" {...field('moisturePercent')} /></Field></div>{error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/10 p-3 text-xs text-red-300">{error}</div>}<button className="btn btn-primary mt-5 w-full justify-center" disabled={busy || !form.commodity || !Number(form.quantityKg) || form.sourceCountry.length !== 2} onClick={submit}><PackagePlus size={16} />{busy ? 'Recording…' : 'Create inventory'}<ArrowRight size={15} /></button></div>
    </section>
  </Layout>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="form-label">{label}</span>{children}</label>; }
