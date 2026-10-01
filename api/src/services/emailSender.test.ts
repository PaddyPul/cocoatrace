import net from 'net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import logger from '../logger';
import type { EmailDeliveryResult, EmailMessage, EmailSender } from './emailSender';
import { DevelopmentEmailSender, sendInvitationEmail, sendPasswordResetEmail, sendVerificationEmail } from './emailSender';

class CapturingSender implements EmailSender {
  messages: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    this.messages.push(message);
    return { status: 'sent', messageId: 'captured@example.test' };
  }
  async healthcheck(): Promise<void> { return undefined; }
}

const changedEnvironment = [
  'APP_ENV', 'EMAIL_DRIVER', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
  'SMTP_REQUIRE_TLS', 'SMTP_TLS_REJECT_UNAUTHORIZED', 'SMTP_USER', 'SMTP_PASSWORD',
  'PUBLIC_WEB_URL', 'WEB_URL',
] as const;

afterEach(() => {
  vi.restoreAllMocks();
  for (const name of changedEnvironment) delete process.env[name];
  vi.resetModules();
});

describe('identity email templates', () => {
  it('builds reset, invitation and verification messages through the port', async () => {
    const sender = new CapturingSender();
    await sendPasswordResetEmail({ to: 'buyer@example.com', resetUrl: 'http://localhost:3000/reset?token=reset-secret' }, sender);
    await sendInvitationEmail({ to: 'supplier@example.com', invitationUrl: 'http://localhost:3000/invite?token=invite-secret', organizationName: 'Supplier Ltd' }, sender);
    await sendVerificationEmail({ to: 'owner@example.com', verificationUrl: 'http://localhost:3000/verify?token=verify-secret', organizationName: 'Buyer Ltd' }, sender);

    expect(sender.messages.map(({ category }) => category)).toEqual(['password_reset', 'invitation', 'email_verification']);
    expect(sender.messages[0].text).toContain('reset-secret');
    expect(sender.messages[1].text).toContain('Supplier Ltd');
    expect(sender.messages[2].text).toContain('verify-secret');
  });

  it('rejects identity links outside the configured public origin', async () => {
    await expect(sendPasswordResetEmail({
      to: 'buyer@example.com',
      resetUrl: 'https://attacker.example/reset?token=secret',
    }, new CapturingSender())).rejects.toThrow(/configured public web origin/);
  });

  it('does not log recipient addresses, bodies or identity URLs in development', async () => {
    const log = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const sender = new DevelopmentEmailSender();
    await sender.send({
      to: 'private-person@example.com',
      subject: 'Reset your password',
      text: 'http://localhost:3000/reset?token=raw-secret-token',
      category: 'password_reset',
    });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('private-person@example.com');
    expect(logged).not.toContain('raw-secret-token');
    expect(logged).toContain('password_reset');
  });

  it('rejects recipient header injection', async () => {
    await expect(new DevelopmentEmailSender().send({
      to: 'person@example.com\r\nBcc: attacker@example.com',
      subject: 'Invitation',
      text: 'Safe body',
      category: 'invitation',
    })).rejects.toThrow(/recipient is invalid/);
  });
});

describe('SMTP adapter', () => {
  it('authenticates and submits a message to an SMTP relay', async () => {
    let receivedMessage = '';
    const server = net.createServer((socket) => {
      let buffer = '';
      let dataMode = false;
      socket.write('220 smtp.test ESMTP\r\n');
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        while (true) {
          if (dataMode) {
            const end = buffer.indexOf('\r\n.\r\n');
            if (end < 0) return;
            receivedMessage = buffer.slice(0, end);
            buffer = buffer.slice(end + 5);
            dataMode = false;
            socket.write('250 accepted\r\n');
            continue;
          }
          const newline = buffer.indexOf('\r\n');
          if (newline < 0) return;
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 2);
          if (line.startsWith('EHLO ')) socket.write('250-smtp.test\r\n250 AUTH PLAIN LOGIN\r\n');
          else if (line.startsWith('AUTH PLAIN ')) socket.write('235 authenticated\r\n');
          else if (line.startsWith('MAIL FROM:')) socket.write('250 sender accepted\r\n');
          else if (line.startsWith('RCPT TO:')) socket.write('250 recipient accepted\r\n');
          else if (line === 'DATA') { dataMode = true; socket.write('354 end with dot\r\n'); }
          else if (line === 'QUIT') { socket.end('221 goodbye\r\n'); return; }
          else socket.write('500 unexpected command\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test SMTP server did not bind');

    Object.assign(process.env, {
      APP_ENV: 'test', EMAIL_DRIVER: 'smtp', EMAIL_FROM: 'identity@cocoatrace.test',
      SMTP_HOST: '127.0.0.1', SMTP_PORT: String(address.port), SMTP_SECURE: 'false',
      SMTP_REQUIRE_TLS: 'false', SMTP_TLS_REJECT_UNAUTHORIZED: 'false',
      SMTP_USER: 'smtp-user', SMTP_PASSWORD: 'smtp-password',
      WEB_URL: 'http://localhost:3000', PUBLIC_WEB_URL: 'http://localhost:3000',
    });

    try {
      vi.resetModules();
      const { SmtpEmailSender: TestSmtpEmailSender } = await import('./emailSender');
      const result = await new TestSmtpEmailSender().send({
        to: 'recipient@example.com',
        subject: 'CocoaTrace test',
        text: 'Line one\n.Line two',
        category: 'email_verification',
      });
      expect(result.status).toBe('sent');
      expect(receivedMessage).toContain('To: recipient@example.com');
      expect(receivedMessage).toContain('Subject: CocoaTrace test');
      expect(receivedMessage).toContain('Line one\r\n..Line two');
      expect(receivedMessage).not.toContain('smtp-password');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
