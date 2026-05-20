import { useState, FormEvent } from 'react';
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

export default function LoginPage() {
  const { login, loading } = useAuthCtx();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const quickLogin = (e: string) => {
    setEmail(e);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-darker">
      <div className="bg-surface-dark border border-border rounded-xl p-10 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-xl">
            🫘
          </div>
          <div>
            <h1 className="text-xl font-semibold">CocoaTrace</h1>
            <p className="text-xs text-text-muted">Provenance Platform</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-1">Welcome back</h2>
        <p className="text-xs text-text-secondary mb-7">Sign in to your account</p>

        {error && (
          <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 mb-4 text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full justify-center mt-1"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border/50">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
            Quick logins (all: Password123!)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_USERS.map((u) => (
              <button
                key={u.email}
                className="px-2.5 py-1 bg-surface-darker border border-border-strong rounded-full text-[11px] text-text-secondary cursor-pointer hover:bg-brand-500/10 hover:border-brand-500 hover:text-brand-400 transition-all"
                onClick={() => quickLogin(u.email)}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
