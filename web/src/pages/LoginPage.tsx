import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, Leaf, QrCode, Route, Search, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { workspace } from '../api';

const QUICK_USERS = [
  { label: 'New buyer', email: 'newbuyer@cocoatrace.io' },
  { label: 'New supplier', email: 'newsupplier@cocoatrace.io' },
  { label: 'New pilot', email: 'pilot@cocoatrace.io' },
  { label: 'Admin', email: 'admin@cocoatrace.io' },
  { label: 'Farmer', email: 'kwame@farm.gh' },
  { label: 'Certifier', email: 'akosua@organiccert.gh' },
  { label: 'Exporter', email: 'ama@accragold.gh' },
  { label: 'Importer', email: 'pieter@dutchcacao.nl' },
  { label: 'Logistics', email: 'kofi@marecargo.gh' },
  { label: 'Regulator', email: 'ingrid@cocobod.gh' },
];

const VALUE_POINTS = [
  { icon: Search, title: 'Source directly from verified supply', copy: 'Match a buyer requirement to commercial terms and proof in one place.' },
  { icon: Route, title: 'Keep field identity through every change', copy: 'Follow material through blending, repacking, shipment and sale.' },
  { icon: ShieldCheck, title: 'Respond with precision', copy: 'Know which lots, quantities and recipients are actually affected.' },
];

export default function LoginPage() {
  const { login } = useAuthCtx();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = (nextEmail: string) => {
    setEmail(nextEmail);
    setPassword('Password123!');
    setError('');
  };

  const launchDemo = async () => {
    setError('');
    setSubmitting(true);
    try {
      await login('admin@cocoatrace.io', 'Password123!');
      navigate('/demo');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const launchNewExperience = async (mode: 'buy' | 'sell') => {
    setError(''); setSubmitting(true);
    try {
      await login(mode === 'buy' ? 'newbuyer@cocoatrace.io' : 'newsupplier@cocoatrace.io', 'Password123!');
      await workspace.updateOnboarding({ status: 'not_started', currentStep: 0, primaryGoal: mode === 'buy' ? 'buy_verified' : 'sell_verified', pilotMode: true });
      localStorage.setItem('ct_experience_mode', mode);
      navigate('/onboarding');
    } catch (err: any) { setError(err.message || 'Could not start the new-user experience'); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-screen bg-[#08110d] text-white lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 p-12 lg:flex lg:flex-col">
        <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500 shadow-xl shadow-brand-900/40"><Leaf size={22} /></span><div><div className="text-lg font-bold">CocoaTrace</div><div className="text-[10px] uppercase tracking-[.2em] text-emerald-200/50">Verified sourcing network</div></div></div>

        <div className="relative my-auto max-w-2xl py-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Ghana → Netherlands corridor</div>
          <h1 className="max-w-xl text-5xl font-bold leading-[1.08] tracking-[-.04em]">Trade organic raw materials with proof built in.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">A direct buyer–supplier network that connects commercial decisions to field-level origin, certification and custody evidence.</p>
          <div className="mt-10 grid gap-4">{VALUE_POINTS.map(({ icon: Icon, title, copy }) => <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-4 backdrop-blur"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300"><Icon size={19} /></span><div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-white/45">{copy}</div></div></div>)}</div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-white/35"><CheckCircle2 size={14} className="text-brand-400" />Evidence-backed records · Role-based access · Live safety status</div>
      </section>

      <section className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500"><Leaf size={20} /></span><div><div className="font-bold">CocoaTrace</div><div className="text-[9px] uppercase tracking-[.18em] text-white/40">Verified sourcing network</div></div></div>
          <div className="mb-7"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-300">Explore the full product</div><h2 className="mt-2 text-3xl font-bold tracking-tight">Choose your starting point</h2><p className="mt-2 text-sm text-white/45">Start as a new user, or sign in to an existing organization workspace.</p></div>

          {error && <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</div>}

          <div className="mb-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => launchNewExperience('buy')} disabled={submitting} className="rounded-2xl border border-brand-300/25 bg-brand-300/10 p-4 text-left transition hover:bg-brand-300/15"><Search size={19} className="text-brand-300" /><span className="mt-4 block text-sm font-bold">Experience as a new buyer</span><span className="mt-1 block text-[11px] leading-5 text-white/45">Onboard, state a need and compare verified supply.</span></button><button type="button" onClick={() => launchNewExperience('sell')} disabled={submitting} className="rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-4 text-left transition hover:bg-amber-300/10"><ShoppingBag size={19} className="text-amber-200" /><span className="mt-4 block text-sm font-bold">Experience as a new supplier</span><span className="mt-1 block text-[11px] leading-5 text-white/45">Onboard, package a lot and reach qualified buyers.</span></button></div>

          <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="text-[9px] font-bold uppercase tracking-[.16em] text-white/25">Existing account</span><div className="h-px flex-1 bg-white/10" /></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[.14em] text-white/40">Email address</label><input type="email" className="min-h-12 w-full rounded-xl border border-white/15 bg-white/[.05] px-4 text-sm outline-none transition placeholder:text-white/25 focus:border-brand-400 focus:bg-white/[.08]" placeholder="you@organization.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[.14em] text-white/40">Password</label><input type="password" className="min-h-12 w-full rounded-xl border border-white/15 bg-white/[.05] px-4 text-sm outline-none transition placeholder:text-white/25 focus:border-brand-400 focus:bg-white/[.08]" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold shadow-xl shadow-brand-900/30 transition hover:bg-brand-400" disabled={submitting}>{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</button>
          </form>

          <div className="my-7 flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="text-[9px] font-bold uppercase tracking-[.16em] text-white/25">More demo access</span><div className="h-px flex-1 bg-white/10" /></div>
          <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 text-sm font-bold text-emerald-200 transition hover:bg-emerald-300/15" onClick={launchDemo} disabled={submitting}><QrCode size={17} />{submitting ? 'Opening demo…' : 'Launch investor demo'}<ArrowRight size={15} /></button>
          <a href="/p/asante-cocoa-2024-0847" target="_blank" rel="noreferrer" className="mt-2 flex min-h-10 w-full items-center justify-center text-xs font-semibold text-white/45 transition hover:text-white">View public product profile without signing in</a>
          <p className="mb-3 text-xs text-white/40">Choose a role to prefill the seeded demonstration account.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{QUICK_USERS.map((user) => <button key={user.email} type="button" className={`rounded-xl border px-3 py-2.5 text-left text-[11px] font-semibold transition ${email === user.email ? 'border-brand-400 bg-brand-400/15 text-brand-200' : 'border-white/10 bg-white/[.03] text-white/55 hover:border-white/25 hover:bg-white/[.06] hover:text-white'}`} onClick={() => quickLogin(user.email)}>{user.label}</button>)}</div>
          <p className="mt-5 text-center text-[10px] text-white/25">Demo password: Password123!</p>
        </div>
      </section>
    </main>
  );
}
