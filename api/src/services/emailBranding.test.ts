import { describe, expect, it } from 'vitest';
import { brandedEmail } from './emailBranding';
import { buildMessage, type IdentityEmailCategory } from './emailSender';
const options = {
  publicWebUrl: 'https://app.example.test',
  environment: 'staging',
  deployed: true,
};
const message = {
  to: 'recipient@example.test',
  subject: 'Your BetterTrade invitation',
  category: 'invitation' as const,
  text: 'Hello <script>alert(1)</script>,\n\nYou were invited to Seller & Sons.\nhttps://app.example.test/accept-invite/secret-token\n\nIgnore if unexpected.',
};
describe('BetterTrade transactional email presentation', () => {
  it('keeps credential URLs in the action and text fallback, while showing only the expected host as link text', () => {
    const result = brandedEmail(message, options);
    expect(result.html).toContain('Accept invitation');
    expect(result.html).toContain('href="https://app.example.test/accept-invite/secret-token"');
    expect(result.html).not.toContain('>https://app.example.test/accept-invite/secret-token<');
    expect(result.text).toContain('https://app.example.test/accept-invite/secret-token');
    expect(result.html).toContain('app.example.test');
    expect(result.html).toContain('Staging - test message');
    expect(result.html).toContain('time-limited');
    expect(result.html).toContain('Seller &amp; Sons');
    expect(result.html).not.toContain('<script>');
  });
  it('does not create action buttons for foreign, credentialed, fragment or unsafe scheme URLs', () => {
    for (const url of [
      'https://app.example.test.evil.test/secret',
      'https://evil.test',
      'https://user:pass@app.example.test/secret',
      'https://app.example.test/#secret',
      'javascript:alert(1)',
      'data:text/html,evil',
    ]) {
      const result = brandedEmail({ ...message, text: url }, options);
      expect(result.html).not.toContain('href=');
    }
    expect(() =>
      brandedEmail(message, { ...options, publicWebUrl: 'http://app.example.test' }),
    ).toThrow();
    expect(() =>
      brandedEmail(message, { ...options, publicWebUrl: 'https://user:pass@app.example.test' }),
    ).toThrow();
  });
  it('renders every existing category with escaped text and no untrusted caller HTML', () => {
    for (const category of [
      'email_verification',
      'invitation',
      'password_reset',
      'recall',
      'payment_reminder',
      'operations_alert',
      'fee_statement',
    ] as IdentityEmailCategory[]) {
      const result = brandedEmail(
        { ...message, category, html: '<img src=x onerror=evil()>' },
        options,
      );
      expect(result.html).toContain('BetterTrade');
      expect(result.html).not.toContain('onerror=');
      expect(result.html).toContain('width:100%;max-width:600px');
      expect(result.text).not.toContain('Local/demo');
    }
  });
  it('uses only an explicitly configured real support address and rejects injection', () => {
    const result = brandedEmail(message, { ...options, supportEmail: 'help@example.test' });
    expect(result.html).toContain('mailto:help@example.test');
    expect(result.text).toContain('Support: help@example.test');
    expect(brandedEmail(message, options).html).not.toContain('mailto:');
    expect(() =>
      brandedEmail(message, {
        ...options,
        supportEmail: 'x@example.test\r\nBcc: stolen@example.test',
      }),
    ).toThrow();
  });
  it('marks local messages and allows the configured local HTTP origin without implying external authentication', () => {
    const result = brandedEmail(
      { ...message, text: 'http://127.0.0.1:14000/reset?token=secret' },
      { publicWebUrl: 'http://127.0.0.1:14000', environment: 'demo', deployed: false },
    );
    expect(result.html).toContain('Local/demo - test message');
    expect(result.html).toContain('127.0.0.1:14000');
    expect(result.html).not.toContain('verified sender');
  });
  it('SMTP MIME contains a branded From, both alternative bodies and no header-injection path', () => {
    const mime = buildMessage(
      { ...message, text: 'Sample body' },
      'sender@example.test',
      'fixture@example.test',
    );
    expect(mime).toContain('From: BetterTrade <sender@example.test>');
    expect(mime).toContain('multipart/alternative');
    expect(mime).toContain('Content-Type: text/html');
    expect(mime).toContain('Content-Type: text/plain');
    expect(mime).toContain('Sample body');
    expect(() =>
      buildMessage(
        { ...message, subject: 'Hi\r\nBcc: stolen@example.test' },
        'sender@example.test',
        'id',
      ),
    ).toThrow();
  });
});
