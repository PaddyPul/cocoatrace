import { useCallback, useEffect, useState } from 'react';
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from '../api';
import { verifyPasskey } from '../mfa';
import { useAuthCtx } from '../components/auth/AuthProvider';
interface Key {
  id: string;
  label: string;
}
export default function PasskeysPage() {
  const { user, logout } = useAuthCtx();
  const hostname = window.location.hostname;
  const ipOrigin = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[');
  const localOrigin = ['127.0.0.1', '[::1]'].includes(hostname);
  const localUrl = new URL('/account/passkeys', window.location.origin);
  localUrl.hostname = 'localhost';
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState('');
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('My passkey');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const loadKeys = useCallback(async () => {
    setLoading(true);
    setReadError('');
    setKeys(null);
    try {
      const value = await api<{ keys: Key[] }>('GET', '/auth/mfa/keys');
      if (
        !value ||
        !Array.isArray(value.keys) ||
        !value.keys.every(
          (key) => key && typeof key.id === 'string' && typeof key.label === 'string',
        )
      )
        throw new Error('Invalid passkey list response.');
      setKeys(value.keys);
    } catch (cause) {
      setReadError(cause instanceof Error ? cause.message : 'Passkey list unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);
  async function act(work: () => Promise<void>) {
    if (ipOrigin) {
      setError('Open BetterTrade using its domain name before using a passkey.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await work();
      window.location.assign('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey action failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-surface-darker px-4 py-12">
      <section className="mx-auto max-w-xl rounded-3xl border border-border bg-surface p-6">
        <h1 className="text-2xl font-bold">Protect your account with a passkey</h1>
        <p className="mt-3 text-sm">
          Use your device’s biometric or PIN verification, or a security key. Privileged accounts
          require this protection before entering the workspace.
        </p>
        <p className="mt-3 text-sm text-text-muted">
          Keep a second key on another device. Password resets keep your passkeys. If all keys are
          lost, access stays restricted until support completes a reviewed recovery.
        </p>
        {ipOrigin && (
          <div role="alert" className="mt-4 text-amber-200">
            <p>Passkeys cannot use an IP address as their domain.</p>
            {localOrigin ? (
              <p>
                Use the local hostname and sign in again:{' '}
                <a className="underline" href={localUrl.toString()}>
                  Open localhost for passkeys
                </a>
                . Existing records are retained.
              </p>
            ) : (
              <p>Open the configured HTTPS domain for this application.</p>
            )}
          </div>
        )}
        {loading && (
          <p role="status" className="mt-4">
            Loading passkeys…
          </p>
        )}
        {readError && (
          <div role="alert" className="mt-4">
            <p>Passkeys could not be loaded. Existing protection is unknown. {readError}</p>
            <button
              className="btn btn-secondary mt-2"
              disabled={loading || busy}
              onClick={() => void loadKeys()}
            >
              Retry passkeys
            </button>
          </div>
        )}
        {keys?.length === 0 && (
          <p className="mt-4">No enrolled passkeys were returned for this account.</p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-red-400">
            {error}
          </p>
        )}
        {keys && keys.length > 0 && (
          <button
            className="btn btn-primary mt-5"
            disabled={busy || ipOrigin}
            onClick={() => act(verifyPasskey)}
          >
            Verify passkey and continue
          </button>
        )}
        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void act(async () => {
              if (keys?.length) await verifyPasskey();
              const optionsJSON = await api<PublicKeyCredentialCreationOptionsJSON>(
                'POST',
                '/auth/mfa/registration/options',
                { currentPassword: password },
              );
              const response = await startRegistration({ optionsJSON });
              await api('POST', '/auth/mfa/registration/verify', { response, label });
            });
          }}
        >
          <label className="block">
            Passkey name
            <input
              required
              maxLength={80}
              className="form-input mt-1"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="block">
            Current password
            <input
              required
              type="password"
              autoComplete="current-password"
              className="form-input mt-1"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={busy || loading || keys === null || ipOrigin}
          >
            {keys?.length ? 'Add a backup passkey' : 'Enroll passkey'}
          </button>
        </form>
        <ul className="mt-6 space-y-3">
          {keys?.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-3">
              <span>{key.label}</span>
              <button
                disabled={busy || ipOrigin}
                className="btn btn-secondary"
                onClick={() =>
                  act(async () => {
                    await verifyPasskey();
                    await api('DELETE', `/auth/mfa/keys/${encodeURIComponent(key.id)}`);
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-text-muted">
          To remove a key, verify using a different key. The last enrolled key cannot be removed.
        </p>
        {user?.mfa?.verified && (
          <a className="btn btn-secondary mt-6 mr-3" href="/home">
            Return to workspace
          </a>
        )}
        <button className="btn btn-secondary mt-6" onClick={logout}>
          Sign out
        </button>
      </section>
    </main>
  );
}
