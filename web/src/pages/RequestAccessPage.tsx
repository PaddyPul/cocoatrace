import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AuthPageShell from '../components/auth/AuthPageShell';
import { auth } from '../api';

export default function RequestAccessPage() {
  const [form, setForm] = useState({ organizationName: '', organizationType: 'supplier' as 'buyer' | 'supplier', jurisdiction: 'GH', legalRegistrationNumber: '', adminName: '', adminEmail: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<{ email: string; verificationUrl?: string } | null>(null);
  const field = (name: keyof typeof form) => ({ value: form[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [name]: event.target.value })) });

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await auth.requestAccess({ ...form, organizationName: form.organizationName.trim(), adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim().toLowerCase(), jurisdiction: form.jurisdiction.trim().toUpperCase(), legalRegistrationNumber: form.legalRegistrationNumber.trim() || undefined });
      setSubmitted({ email: form.adminEmail.trim().toLowerCase(), verificationUrl: result.verificationUrl });
    } catch (err: any) { setError(err.message || 'Could not submit the access request'); }
    finally { setBusy(false); }
  };

  return <AuthPageShell eyebrow="Controlled pilot access" title="Request an organization workspace" description="CocoaTrace reviews each buyer and supplier organization before creating its first administrator. Submitting this form does not create an account or mark your organization as verified.">
    {submitted ? <div className="rounded-2xl border border-brand-300/20 bg-brand-300/5 p-5">
      <CheckCircle2 size={30} className="text-brand-300" />
      <h2 className="mt-4 text-lg font-bold">Verify your email address</h2>
      <p className="mt-2 text-xs leading-5 text-white/50">If the request can proceed, instructions have been sent to <strong className="text-white/75">{submitted.email}</strong>. After verification, the organization enters manual review.</p>
      {submitted.verificationUrl && <a href={submitted.verificationUrl} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-300/20 px-4 text-xs font-semibold text-brand-200">Open demo verification link <ArrowRight size={13} /></a>}
      <Link to="/login" className="mt-5 block text-xs font-semibold text-white/45 hover:text-white">Return to sign in</Link>
    </div> : <form onSubmit={submit} className="space-y-4">
      <Field label="Organization name"><input required minLength={2} className="form-input" autoComplete="organization" {...field('organizationName')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization role"><select className="form-select" {...field('organizationType')}><option value="supplier">Supplier / exporter</option><option value="buyer">Buyer / importer</option></select></Field>
        <Field label="Jurisdiction (ISO code)"><input required minLength={2} maxLength={2} className="form-input uppercase" {...field('jurisdiction')} /></Field>
      </div>
      <Field label="Legal registration number (optional)"><input className="form-input" autoComplete="off" {...field('legalRegistrationNumber')} /></Field>
      <div className="border-t border-white/10 pt-4"><div className="mb-4 text-[10px] font-bold uppercase tracking-[.14em] text-white/35">First administrator</div><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input required minLength={2} className="form-input" autoComplete="name" {...field('adminName')} /></Field>
        <Field label="Work email"><input required type="email" className="form-input" autoComplete="email" {...field('adminEmail')} /></Field>
      </div></div>
      {error && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}
      <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950 disabled:opacity-50">{busy ? 'Submitting…' : <>Submit access request <ArrowRight size={15} /></>}</button>
      <p className="text-center text-xs text-white/40">Already invited? <Link to="/login" className="font-semibold text-brand-300">Sign in</Link></p>
    </form>}
  </AuthPageShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="form-label">{label}</span>{children}</label>; }

