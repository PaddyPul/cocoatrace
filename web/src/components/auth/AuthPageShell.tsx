import { Leaf, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return <main className="grid min-h-screen place-items-center bg-[#09110d] p-5 text-white sm:p-8">
    <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[.035] p-6 shadow-2xl shadow-black/30 sm:p-8">
      <Link to="/login" className="inline-flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500"><Leaf size={19} /></span>
        <span><span className="block text-sm font-bold">CocoaTrace</span><span className="block text-[9px] uppercase tracking-[.16em] text-white/35">Secure workspace access</span></span>
      </Link>
      <div className="mt-8 text-[10px] font-bold uppercase tracking-[.16em] text-brand-300">{eyebrow}</div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-white/45">{description}</p>
      <div className="mt-7">{children}</div>
      <div className="mt-6 flex items-start gap-2 border-t border-white/10 pt-5 text-[10px] leading-5 text-white/35">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-300" />
        Access requests and account-recovery actions are recorded and never grant an organization verification status automatically.
      </div>
    </section>
  </main>;
}

