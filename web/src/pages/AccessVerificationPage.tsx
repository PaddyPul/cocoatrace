import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AuthPageShell from '../components/auth/AuthPageShell';
import { auth } from '../api';

const verificationRequests = new Map<string, ReturnType<typeof auth.verifyAccessRequest>>();

export default function AccessVerificationPage() {
  const { token: pathToken } = useParams();
  const [params] = useSearchParams();
  const token = pathToken || params.get('token') || '';
  const [state, setState] = useState<'working' | 'verified' | 'error'>(token ? 'working' : 'error');
  const [error, setError] = useState(token ? '' : 'The verification link is incomplete.');

  useEffect(() => {
    if (!token) return;
    let active = true;
    const request = verificationRequests.get(token) || auth.verifyAccessRequest(token);
    verificationRequests.set(token, request);
    request.then(() => { if (active) setState('verified'); }).catch((err) => { if (active) { setError(err.message || 'This verification link is invalid or expired.'); setState('error'); } });
    return () => { active = false; };
  }, [token]);

  return <AuthPageShell eyebrow="Email verification" title={state === 'working' ? 'Verifying your request…' : state === 'verified' ? 'Email address verified' : 'Verification unavailable'} description={state === 'verified' ? 'Your organization request is now waiting for manual review. Approval creates an invitation for the proposed administrator; it does not create a user silently.' : 'Access-request links are single-purpose and expire for your protection.'}>
    <div className={`rounded-2xl border p-6 text-center ${state === 'error' ? 'border-red-400/25 bg-red-400/5' : 'border-brand-300/20 bg-brand-300/5'}`}>
      {state === 'working' ? <><div className="spinner mx-auto" /><p className="mt-4 text-xs text-white/50">Checking the signed verification token…</p></> : state === 'verified' ? <><CheckCircle2 size={38} className="mx-auto text-brand-300" /><p className="mt-4 text-sm font-semibold">The review team can now assess your organization.</p><p className="mt-2 text-xs leading-5 text-white/45">You will receive a separate invitation only if the application is approved.</p></> : <><XCircle size={38} className="mx-auto text-red-300" /><p role="alert" className="mt-4 text-xs leading-5 text-red-200">{error}</p></>}
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs"><span className="inline-flex items-center gap-2 text-white/35"><Clock3 size={13} />Manual review protects the network</span><Link to={state === 'error' ? '/request-access' : '/login'} className="font-semibold text-brand-300">{state === 'error' ? 'Submit a new request' : 'Return to sign in'}</Link></div>
  </AuthPageShell>;
}

