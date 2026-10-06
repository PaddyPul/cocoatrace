import { startAuthentication } from '@simplewebauthn/browser';
import { api } from './api';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
export async function verifyPasskey(): Promise<void> {
  const optionsJSON = await api<PublicKeyCredentialRequestOptionsJSON>('POST','/auth/mfa/authentication/options',{});
  const response = await startAuthentication({optionsJSON});
  await api('POST','/auth/mfa/authentication/verify',{response});
}
