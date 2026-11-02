import { describe, expect, it } from 'vitest';
import { bootstrapFailureMessage, parseBootstrapInput } from './bootstrapInput';

describe('administrator credential diagnostics', () => {
  it('identifies the invalid field without including its secret value', () => {
    for (const [email, password, field] of [
      ['bad-address', 'unique-secure-password-4827!', 'email'],
      ['owner@example.test', 'hidden-short', 'password'],
      ['owner@example.test', '\u001b[200~unique-secret-4827!', 'password'],
      ['owner@example.test', 'é'.repeat(40), 'password'],
    ]) {
      try {
        parseBootstrapInput({ email, password });
        throw new Error('Unexpected acceptance');
      } catch (error) {
        const message = bootstrapFailureMessage(error);
        expect(message).toContain(field);
        expect(message).not.toContain(password);
        expect(message).not.toContain(email);
      }
    }
  });
  it('preserves a valid Unicode password exactly and normalizes only the email', () => {
    const password = 'unique-été-password-4827!';
    expect(parseBootstrapInput({ email: ' OWNER@example.test ', password })).toEqual({
      email: 'owner@example.test',
      password,
    });
  });
  it('reports only a validated SQLSTATE for unexpected database errors', () => {
    expect(
      bootstrapFailureMessage({ code: '23505', detail: 'secret@example.test password=private' }),
    ).toContain('23505');
    expect(bootstrapFailureMessage({ code: 'password=private', message: 'private' })).not.toContain(
      'private',
    );
    expect(bootstrapFailureMessage(new SyntaxError('private-payload'))).not.toContain(
      'private-payload',
    );
  });
});
