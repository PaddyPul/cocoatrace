import { describe, expect, it } from 'vitest';
import { verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { authenticator } from '../../testing/webauthnFixture';
// Verifies genuine protocol signatures without mocking the WebAuthn verifier.
describe('real WebAuthn cryptography', () => {
  it('validates registration and signed authentication with UV', async () => {
    const key = authenticator(),
      challenge = 'test-challenge-base64url',
      origin = 'http://localhost:3000',
      rp = 'localhost';
    const registered = await verifyRegistrationResponse({
      response: key.registration(challenge),
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rp,
      requireUserVerification: true,
    });
    expect(registered.verified).toBe(true);
    const verified = await verifyAuthenticationResponse({
      response: key.authentication(challenge),
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rp,
      requireUserVerification: true,
      credential: registered.registrationInfo!.credential,
    });
    expect(verified.verified).toBe(true);
  });
  it.each(['origin', 'rp', 'uv'])('rejects %s even with a valid signature', async (failure) => {
    const key = authenticator(),
      challenge = 'test-challenge-base64url';
    await expect(
      verifyRegistrationResponse({
        response: key.registration(
          challenge,
          failure === 'origin' ? 'https://evil.example' : 'http://localhost:3000',
          failure === 'rp' ? 'evil.example' : 'localhost',
          failure !== 'uv',
        ),
        expectedChallenge: challenge,
        expectedOrigin: 'http://localhost:3000',
        expectedRPID: 'localhost',
        requireUserVerification: true,
      }),
    ).rejects.toThrow();
  });
  it.each(['origin', 'rp', 'uv', 'challenge'])(
    'rejects %s in a signed assertion',
    async (failure) => {
      const key = authenticator(),
        challenge = 'test-challenge-base64url';
      const registered = await verifyRegistrationResponse({
        response: key.registration(challenge),
        expectedChallenge: challenge,
        expectedOrigin: 'http://localhost:3000',
        expectedRPID: 'localhost',
        requireUserVerification: true,
      });
      await expect(
        verifyAuthenticationResponse({
          response: key.authentication(
            failure === 'challenge' ? 'wrong-challenge' : challenge,
            1,
            failure === 'origin' ? 'https://evil.example' : 'http://localhost:3000',
            failure === 'rp' ? 'evil.example' : 'localhost',
            failure !== 'uv',
          ),
          expectedChallenge: challenge,
          expectedOrigin: 'http://localhost:3000',
          expectedRPID: 'localhost',
          requireUserVerification: true,
          credential: registered.registrationInfo!.credential,
        }),
      ).rejects.toThrow();
    },
  );
});
