import crypto from 'crypto';
import net from 'net';
import os from 'os';
import tls from 'tls';
import { config } from '../config/env';
import logger from '../logger';

export type IdentityEmailCategory = 'email_verification' | 'invitation' | 'password_reset';

export type EmailMessage = Readonly<{
  to: string | readonly string[];
  subject: string;
  text: string;
  html?: string;
  category: IdentityEmailCategory;
}>;

export type EmailDeliveryResult = Readonly<{
  status: 'sent' | 'suppressed';
  messageId?: string;
}>;

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
  healthcheck(): Promise<void>;
}

type SmtpResponse = Readonly<{ code: number; lines: string[] }>;
type SocketState = { buffer: string };

function recipients(value: EmailMessage['to']): string[] {
  const addresses = typeof value === 'string' ? [value] : [...value];
  if (addresses.length === 0) throw new Error('Email requires at least one recipient');
  for (const address of addresses) {
    if (/\r|\n/.test(address) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      throw new Error('Email recipient is invalid');
    }
  }
  return addresses;
}

function safeHeader(value: string, name: string): string {
  if (/\r|\n/.test(value)) throw new Error(`${name} contains an invalid line break`);
  return value;
}

function encodedSubject(value: string): string {
  const subject = safeHeader(value, 'Email subject');
  return /^[\x20-\x7E]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function dotStuff(value: string): string {
  return value.replace(/\r?\n/g, '\r\n').replace(/(^|\r\n)\./g, '$1..');
}

function buildMessage(message: EmailMessage, from: string, messageId: string): string {
  const to = recipients(message.to);
  const headers = [
    `From: ${safeHeader(from, 'Email sender')}`,
    `To: ${to.join(', ')}`,
    `Subject: ${encodedSubject(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}>`,
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
  ];

  if (!message.html) {
    return `${headers.join('\r\n')}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${dotStuff(message.text)}`;
  }

  const boundary = `cocoatrace-${crypto.randomUUID()}`;
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(message.html),
    `--${boundary}--`,
  ].join('\r\n');
}

function connectPlain(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const fail = (error: Error) => { socket.destroy(); reject(error); };
    socket.once('error', fail);
    socket.setTimeout(timeoutMs, () => fail(new Error('SMTP connection timed out')));
    socket.once('connect', () => {
      socket.off('error', fail);
      socket.setTimeout(0);
      resolve(socket);
    });
  });
}

function connectSecure(host: string, port: number, timeoutMs: number, rejectUnauthorized: boolean): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized });
    const fail = (error: Error) => { socket.destroy(); reject(error); };
    socket.once('error', fail);
    socket.setTimeout(timeoutMs, () => fail(new Error('SMTP TLS connection timed out')));
    socket.once('secureConnect', () => {
      socket.off('error', fail);
      socket.setTimeout(0);
      resolve(socket);
    });
  });
}

function upgradeTls(socket: net.Socket, host: string, timeoutMs: number, rejectUnauthorized: boolean): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host, rejectUnauthorized });
    const fail = (error: Error) => { secureSocket.destroy(); reject(error); };
    secureSocket.once('error', fail);
    secureSocket.setTimeout(timeoutMs, () => fail(new Error('SMTP STARTTLS timed out')));
    secureSocket.once('secureConnect', () => {
      secureSocket.off('error', fail);
      secureSocket.setTimeout(0);
      resolve(secureSocket);
    });
  });
}

function readResponse(socket: net.Socket, state: SocketState, timeoutMs: number): Promise<SmtpResponse> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    let responseCode: number | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const processBuffer = () => {
      while (state.buffer.includes('\n')) {
        const newline = state.buffer.indexOf('\n');
        const line = state.buffer.slice(0, newline).replace(/\r$/, '');
        state.buffer = state.buffer.slice(newline + 1);
        const match = line.match(/^(\d{3})([ -])(.*)$/);
        if (!match) return fail(new Error('SMTP server returned a malformed response'));
        const code = Number(match[1]);
        responseCode ??= code;
        if (responseCode !== code) return fail(new Error('SMTP server returned inconsistent response codes'));
        lines.push(match[3]);
        if (match[2] === ' ') {
          cleanup();
          resolve({ code, lines });
          return;
        }
      }
    };
    const onData = (chunk: Buffer) => { state.buffer += chunk.toString('utf8'); processBuffer(); };
    const onError = (error: Error) => fail(error);
    const onClose = () => fail(new Error('SMTP connection closed unexpectedly'));
    const timer = setTimeout(() => fail(new Error('SMTP response timed out')), timeoutMs);
    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
    processBuffer();
  });
}

function write(socket: net.Socket, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(value, 'utf8', (error) => error ? reject(error) : resolve());
  });
}

async function command(socket: net.Socket, state: SocketState, value: string, accepted: readonly number[], timeoutMs: number): Promise<SmtpResponse> {
  await write(socket, `${value}\r\n`);
  const response = await readResponse(socket, state, timeoutMs);
  if (!accepted.includes(response.code)) throw new Error(`SMTP command was rejected with status ${response.code}`);
  return response;
}

export class DevelopmentEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    recipients(message.to);
    safeHeader(message.subject, 'Email subject');
    logger.info({ category: message.category, recipientCount: typeof message.to === 'string' ? 1 : message.to.length }, 'Email delivery suppressed by development adapter');
    return { status: 'suppressed' };
  }

  async healthcheck(): Promise<void> { return undefined; }
}

export class SmtpEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const host = config.smtpHost!;
    const from = config.emailFrom!;
    const timeout = config.smtpConnectionTimeoutMs;
    const addresses = recipients(message.to);
    let socket: net.Socket = config.smtpSecure
      ? await connectSecure(host, config.smtpPort, timeout, config.smtpTlsRejectUnauthorized)
      : await connectPlain(host, config.smtpPort, timeout);
    const state: SocketState = { buffer: '' };
    const messageId = `${crypto.randomUUID()}@${from.split('@')[1]}`;

    try {
      const greeting = await readResponse(socket, state, timeout);
      if (greeting.code !== 220) throw new Error(`SMTP greeting was rejected with status ${greeting.code}`);
      let capabilities = await command(socket, state, `EHLO ${os.hostname() || 'cocoatrace'}`, [250], timeout);

      if (!config.smtpSecure && config.smtpRequireTls) {
        if (!capabilities.lines.some((line) => /^STARTTLS\b/i.test(line))) throw new Error('SMTP server does not advertise required STARTTLS');
        await command(socket, state, 'STARTTLS', [220], timeout);
        socket = await upgradeTls(socket, host, timeout, config.smtpTlsRejectUnauthorized);
        state.buffer = '';
        capabilities = await command(socket, state, `EHLO ${os.hostname() || 'cocoatrace'}`, [250], timeout);
      }

      if (config.smtpAuthMethod === 'plain') {
        const credentials = Buffer.from(`\0${config.smtpUser!}\0${config.smtpPassword!}`, 'utf8').toString('base64');
        await command(socket, state, `AUTH PLAIN ${credentials}`, [235], timeout);
      } else {
        await command(socket, state, 'AUTH LOGIN', [334], timeout);
        await command(socket, state, Buffer.from(config.smtpUser!, 'utf8').toString('base64'), [334], timeout);
        await command(socket, state, Buffer.from(config.smtpPassword!, 'utf8').toString('base64'), [235], timeout);
      }

      await command(socket, state, `MAIL FROM:<${from}>`, [250], timeout);
      for (const address of addresses) await command(socket, state, `RCPT TO:<${address}>`, [250, 251], timeout);
      await command(socket, state, 'DATA', [354], timeout);
      await write(socket, `${buildMessage(message, from, messageId)}\r\n.\r\n`);
      const accepted = await readResponse(socket, state, timeout);
      if (accepted.code !== 250) throw new Error(`SMTP message was rejected with status ${accepted.code}`);
      await command(socket, state, 'QUIT', [221], timeout).catch(() => undefined);
      logger.info({ category: message.category, messageId }, 'Identity email accepted by SMTP relay');
      return { status: 'sent', messageId };
    } finally {
      socket.destroy();
    }
  }

  async healthcheck(): Promise<void> {
    const host = config.smtpHost!;
    const timeout = config.smtpConnectionTimeoutMs;
    let socket: net.Socket = config.smtpSecure
      ? await connectSecure(host, config.smtpPort, config.smtpConnectionTimeoutMs, config.smtpTlsRejectUnauthorized)
      : await connectPlain(host, config.smtpPort, config.smtpConnectionTimeoutMs);
    const state: SocketState = { buffer: '' };
    try {
      const greeting = await readResponse(socket, state, timeout);
      if (greeting.code !== 220) throw new Error(`SMTP healthcheck failed with status ${greeting.code}`);
      let capabilities = await command(socket, state, `EHLO ${os.hostname() || 'cocoatrace'}`, [250], timeout);
      if (!config.smtpSecure && config.smtpRequireTls) {
        if (!capabilities.lines.some((line) => /^STARTTLS\b/i.test(line))) throw new Error('SMTP server does not advertise required STARTTLS');
        await command(socket, state, 'STARTTLS', [220], timeout);
        socket = await upgradeTls(socket, host, timeout, config.smtpTlsRejectUnauthorized);
        state.buffer = '';
        capabilities = await command(socket, state, `EHLO ${os.hostname() || 'cocoatrace'}`, [250], timeout);
      }
      if (config.smtpAuthMethod === 'plain') {
        const credentials = Buffer.from(`\0${config.smtpUser!}\0${config.smtpPassword!}`, 'utf8').toString('base64');
        await command(socket, state, `AUTH PLAIN ${credentials}`, [235], timeout);
      } else {
        await command(socket, state, 'AUTH LOGIN', [334], timeout);
        await command(socket, state, Buffer.from(config.smtpUser!, 'utf8').toString('base64'), [334], timeout);
        await command(socket, state, Buffer.from(config.smtpPassword!, 'utf8').toString('base64'), [235], timeout);
      }
      await command(socket, state, 'QUIT', [221], timeout).catch(() => undefined);
    } finally {
      socket.destroy();
    }
  }
}

let sender: EmailSender | undefined;

export function emailSender(): EmailSender {
  sender ||= config.emailDriver === 'smtp' ? new SmtpEmailSender() : new DevelopmentEmailSender();
  return sender;
}

export function resetEmailSenderForTests(): void { sender = undefined; }

function identityUrl(value: string): string {
  const url = new URL(value);
  const publicOrigin = new URL(config.publicWebUrl).origin;
  if (url.origin !== publicOrigin) throw new Error('Identity email URL must use the configured public web origin');
  if (config.isDeployed && url.protocol !== 'https:') throw new Error('Identity email URL must use HTTPS');
  return url.toString();
}

function greeting(name?: string): string { return name?.trim() ? `Hello ${name.trim()},` : 'Hello,'; }

export async function sendPasswordResetEmail(
  input: { to: string; resetUrl: string; recipientName?: string },
  delivery: EmailSender = emailSender(),
): Promise<EmailDeliveryResult> {
  const url = identityUrl(input.resetUrl);
  return delivery.send({
    to: input.to,
    category: 'password_reset',
    subject: 'Reset your CocoaTrace password',
    text: `${greeting(input.recipientName)}\n\nUse this link to reset your CocoaTrace password:\n${url}\n\nIf you did not request this, you can ignore this email.`,
  });
}

export async function sendInvitationEmail(
  input: { to: string; invitationUrl: string; recipientName?: string; organizationName?: string },
  delivery: EmailSender = emailSender(),
): Promise<EmailDeliveryResult> {
  const url = identityUrl(input.invitationUrl);
  const organization = input.organizationName?.trim() ? ` to join ${input.organizationName.trim()}` : '';
  return delivery.send({
    to: input.to,
    category: 'invitation',
    subject: 'Your CocoaTrace invitation',
    text: `${greeting(input.recipientName)}\n\nYou have been invited${organization} on CocoaTrace. Accept the invitation here:\n${url}\n\nIf you were not expecting this invitation, you can ignore this email.`,
  });
}

export async function sendVerificationEmail(
  input: { to: string; verificationUrl: string; recipientName?: string; organizationName?: string },
  delivery: EmailSender = emailSender(),
): Promise<EmailDeliveryResult> {
  const url = identityUrl(input.verificationUrl);
  const organization = input.organizationName?.trim() ? ` for ${input.organizationName.trim()}` : '';
  return delivery.send({
    to: input.to,
    category: 'email_verification',
    subject: 'Verify your CocoaTrace email',
    text: `${greeting(input.recipientName)}\n\nVerify your email address${organization} by opening this link:\n${url}\n\nIf you did not start this request, you can ignore this email.`,
  });
}
