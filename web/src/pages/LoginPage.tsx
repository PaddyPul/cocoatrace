import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, Leaf, QrCode, Route, ShieldCheck } from 'lucide-react';
import { useAuthCtx } from '../components/auth/AuthProvider';

const QUICK_USERS = [
  { label: 'Admin', email: 'admin@cocoatrace.io' },
  { label: 'Farmer', email: 'kwame@farm.gh' },
  { label: 'Certifier', email: 'akosua@organiccert.gh' },
  { label: 'Exporter', email: 'ama@accragold.gh' },
  { label: 'Importer', email: 'pieter@dutchcacao.nl' },
  { label: 'Logistics', email: 'kofi@marecargo.gh' },
  { label: 'Regulator', email: 'ingrid@cocobod.gh' },
];

const VALUE_POINTS = [
  { icon: Route, title: 'Trace every transformation', copy: 'Follow material from farm lots into finished products.' },
  { icon: ShieldCheck, title: 'Contain recalls precisely', copy: 'Calculate affected lots, quantities and recipients in seconds.' },
  { icon: QrCode, title: 'Give products a live identity', copy: 'One QR connects provenance, evidence and current safety status.' },
];

export default function LoginPage() {
  const { login } = useAuthCtx();
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

  return (
    <main className="min-h-screen bg-[#08110d] text-white lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 p-12 lg:flex lg:flex-col">
        <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500 shadow-xl shadow-brand-900/40"><Leaf size={22} /></span><div><div className="text-lg font-bold">CocoaTrace</div><div className="text-[10px] uppercase tracking-[.2em] text-emerald-200/50">Farm-to-fork intelligence</div></div></div>

        <div className="relative my-auto max-w-2xl py-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Ghana → Netherlands corridor</div>
          <h1 className="max-w-xl text-5xl font-bold leading-[1.08] tracking-[-.04em]">Know where every product came from—and where it went.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">A shared workspace for provenance, certification, trade, logistics and recall readiness.</p>
          <div className="mt-10 grid gap-4">{VALUE_POINTS.map(({ icon: Icon, title, copy }) => <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-4 backdrop-blur"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300"><Icon size={19} /></span><div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-white/45">{copy}</div></div></div>)}</div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-white/35"><CheckCircle2 size={14} className="text-brand-400" />Evidence-backed records · Role-based access · Live safety status</div>
      </section>

      <section className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500"><Leaf size={20} /></span><div><div className="font-bold">CocoaTrace</div><div className="text-[9px] uppercase tracking-[.18em] text-white/40">Farm-to-fork intelligence</div></div></div>
          <div className="mb-7"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-300">Secure workspace</div><h2 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h2><p className="mt-2 text-sm text-white/45">Sign in to continue to your organization workspace.</p></div>

          {error && <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[.14em] text-white/40">Email address</label><input type="email" className="min-h-12 w-full rounded-xl border border-white/15 bg-white/[.05] px-4 text-sm outline-none transition placeholder:text-white/25 focus:border-brand-400 focus:bg-white/[.08]" placeholder="you@organization.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[.14em] text-white/40">Password</label><input type="password" className="min-h-12 w-full rounded-xl border border-white/15 bg-white/[.05] px-4 text-sm outline-none transition placeholder:text-white/25 focus:border-brand-400 focus:bg-white/[.08]" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold shadow-xl shadow-brand-900/30 transition hover:bg-brand-400" disabled={submitting}>{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</button>
          </form>

          <div className="my-7 flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="text-[9px] font-bold uppercase tracking-[.16em] text-white/25">Demo access</span><div className="h-px flex-1 bg-white/10" /></div>
          <p className="mb-3 text-xs text-white/40">Choose a role to prefill the seeded demonstration account.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{QUICK_USERS.map((user) => <button key={user.email} type="button" className={`rounded-xl border px-3 py-2.5 text-left text-[11px] font-semibold transition ${email === user.email ? 'border-brand-400 bg-brand-400/15 text-brand-200' : 'border-white/10 bg-white/[.03] text-white/55 hover:border-white/25 hover:bg-white/[.06] hover:text-white'}`} onClick={() => quickLogin(user.email)}>{user.label}</button>)}</div>
          <p className="mt-5 text-center text-[10px] text-white/25">Demo password: Password123!</p>
        </div>
      </section>
    </main>
  );
}
