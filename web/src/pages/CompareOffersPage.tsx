import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale, ShieldCheck } from 'lucide-react';
import { trustLabel } from '../components/shared/TrustClaims';
import Layout from '../components/layout/Layout';
import { listings } from '../api';
import { Listing } from '../types';
import { SkeletonTable } from '../components/shared/Skeleton';

export default function CompareOffersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listings.list().then((items) => {
    let shortlisted: string[] = [];
    try { shortlisted = JSON.parse(sessionStorage.getItem('ct_shortlisted_listings') || '[]'); } catch { shortlisted = []; }
    setRows(items.filter((item) => shortlisted.includes(item.id)));
  }).finally(() => setLoading(false)); }, []);
  const scored = useMemo(() => rows.map(item => ({ item, gap: trustLabel(item.trust?.organic) })), [rows]);
  if (loading) return <Layout currentPage="source-compare"><SkeletonTable rows={7} cols={4} /></Layout>;
  if (!scored.length) return <Layout currentPage="source-compare" actions={<button className="btn" onClick={() => navigate('/marketplace')}><ArrowLeft size={14} />Back to supply</button>}><div className="rounded-3xl border border-dashed border-border p-10 text-center"><h2 className="text-xl font-bold">Nothing to compare yet</h2><p className="mt-2 text-sm text-text-muted">Shortlist one or more published lots in the marketplace first.</p><button className="btn btn-primary mt-5" onClick={() => navigate('/marketplace')}>Browse supply</button></div></Layout>;
  return <Layout currentPage="source-compare" actions={<button className="btn" onClick={() => navigate('/marketplace')}><ArrowLeft size={14} />Back to supply</button>}>
    <div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-400">Side-by-side decision</div><h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">Compare price with proof—not price instead of proof.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">Compare shortlisted supply using recorded commercial terms and current claim review states. No ranking or arrival date is inferred from missing information.</p>
    <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-surface"><table><thead><tr><th>Decision factor</th>{scored.map(({ item }) => <th key={item.id}>{item.farm_name || item.seller_name || 'Published supply'}</th>)}</tr></thead><tbody><tr><td className="font-semibold text-white">Available quantity</td>{scored.map(({ item }) => <td key={item.id}>{Number(item.available_quantity_kg).toLocaleString()} kg</td>)}</tr><tr><td className="font-semibold text-white">Indicative price</td>{scored.map(({ item }) => <td key={item.id} className="font-mono text-brand-300">€{Number(item.price_per_kg).toFixed(2)}/kg</td>)}</tr><tr><td className="font-semibold text-white">Organic evidence</td>{scored.map(({ item }) => <td key={item.id}>{trustLabel(item.trust?.organic)}</td>)}</tr><tr><td className="font-semibold text-white">Origin visibility</td>{scored.map(({ item }) => <td key={item.id}>{[item.farm_region, item.farm_country || item.source_country].filter(Boolean).join(', ') || item.origin_location || 'Not recorded'}</td>)}</tr><tr><td className="font-semibold text-white">Open assurance issue</td>{scored.map(({ item, gap }) => <td key={item.id}>{gap}</td>)}</tr><tr><td className="font-semibold text-white">Decision</td>{scored.map(({ item }, index) => <td key={item.id}><button className={`btn btn-sm ${index === 0 ? 'btn-primary' : ''}`} onClick={() => navigate(`/listing/${item.id}`)}>Review lot</button></td>)}</tr></tbody></table></div>
    <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center rounded-3xl border border-brand-400/20 bg-brand-400/5 p-5 sm:p-6"><div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-400 text-emerald-950"><Scale size={20} /></span><div><h3 className="text-sm font-bold">Review each offer’s evidence</h3><p className="mt-2 text-xs leading-5 text-text-muted">Open each lot to inspect the claim source, reviewer and expiry before negotiating. Supplier declarations and recorded origin are separate from independently reviewed claims.</p></div></div><div className="flex items-center gap-2 text-[10px] text-brand-300"><ShieldCheck size={14} />Buyer decision required</div></section>
  </Layout>;
}
