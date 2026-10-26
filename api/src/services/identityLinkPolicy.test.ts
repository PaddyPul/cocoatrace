import { describe, expect, it } from 'vitest';
import { allowIdentityLinkPreview } from './identityLinkPolicy';

describe('identity bearer link preview admission', () => {
  it('withholds raw links from a hosted synthetic demo with normal sign-in', () => {
    expect(allowIdentityLinkPreview({ environment: 'demo', demoMode: false })).toBe(false);
  });
  it('retains links for explicit local rehearsal and disposable tests', () => {
    expect(allowIdentityLinkPreview({ environment: 'demo', demoMode: true })).toBe(true);
    expect(allowIdentityLinkPreview({ environment: 'test', demoMode: false })).toBe(true);
  });
  it('does not let a demo-mode flag expose links in other environments', () => {
    for (const environment of ['development', 'staging', 'production'] as const) {
      expect(allowIdentityLinkPreview({ environment, demoMode: true })).toBe(false);
    }
  });
});
