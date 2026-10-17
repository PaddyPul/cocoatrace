import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { config } = vi.hoisted(() => ({
  config: {
    smtpHost: '127.0.0.1',
    smtpPort: 1,
    smtpSecure: false,
    smtpRequireTls: false,
    smtpTlsRejectUnauthorized: true,
    smtpAuthMethod: 'plain',
    smtpUser: 'contract-user',
    smtpPassword: 'contract-secret',
    smtpConnectionTimeoutMs: 1000,
    emailFrom: 'sender@example.test',
  },
}));
vi.mock('../config/env', () => ({ config }));
import { SmtpEmailSender } from '../services/emailSender';

const root = path.resolve(__dirname, '../../..');
const contracts = [
  {
    port: 'EvidenceStorage',
    file: 'api/src/services/evidenceStorage.ts',
    implementations: ['LocalEvidenceStorage', 'S3EvidenceStorage'],
    tests: 'api/src/services/evidenceStorage.test.ts',
  },
  {
    port: 'EvidenceMalwareScanner',
    file: 'api/src/services/evidenceMalwareScanner.ts',
    implementations: ['DevelopmentScanner', 'ClamAvScanner'],
    tests: 'api/src/services/evidenceMalwareScanner.test.ts',
  },
  {
    port: 'EmailSender',
    file: 'api/src/services/emailSender.ts',
    implementations: ['DevelopmentEmailSender', 'SmtpEmailSender'],
    tests: 'api/src/services/emailSender.test.ts',
  },
] as const;

function implementations(text: string): string[] {
  const file = ts.createSourceFile('adapter.ts', text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isClassDeclaration(node)) {
      for (const clause of node.heritageClauses ?? []) {
        if (clause.token !== ts.SyntaxKind.ImplementsKeyword) continue;
        for (const type of clause.types) {
          const port = type.expression.getText(file);
          if (/(?:Storage|Scanner|Sender|Provider|Adapter)$/.test(port)) {
            found.push(`${port}:${node.name?.text ?? '<anonymous>'}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

it('inventories all concrete external adapter ports and requires maintained contract evidence', () => {
  const observed: string[] = [];
  for (const relative of fs.readdirSync(path.join(root, 'api/src'), { recursive: true })) {
    const file = String(relative);
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
    observed.push(...implementations(fs.readFileSync(path.join(root, 'api/src', file), 'utf8')));
  }
  expect(observed.sort()).toEqual(
    contracts.flatMap((row) => row.implementations.map((name) => `${row.port}:${name}`)).sort(),
  );
  const guide = fs.readFileSync(path.join(root, 'docs/testing/ADAPTER_CONTRACTS.md'), 'utf8');
  for (const row of contracts) {
    expect(fs.existsSync(path.join(root, row.tests))).toBe(true);
    for (const pointer of [row.file, row.tests, ...row.implementations])
      expect(guide).toContain(pointer);
    expect(implementations(fs.readFileSync(path.join(root, row.file), 'utf8')).sort()).toEqual(
      row.implementations.map((name) => `${row.port}:${name}`).sort(),
    );
  }
});

it('detects an added implementation and an unregistered future provider port', () => {
  expect(
    implementations(
      'class NewStore implements EvidenceStorage {} class Logistics implements LogisticsProvider {}',
    ),
  ).toEqual(['EvidenceStorage:NewStore', 'LogisticsProvider:Logistics']);
});

afterEach(() => {
  config.smtpRequireTls = false;
  config.smtpConnectionTimeoutMs = 1000;
  vi.restoreAllMocks();
});

async function relay(response: (line: string) => string, work: () => Promise<void>): Promise<void> {
  const clients = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    clients.add(socket);
    socket.on('error', () => undefined);
    socket.on('close', () => clients.delete(socket));
    socket.write('220 contract.test ESMTP\r\n');
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n');
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        socket.write(response(line));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Relay fixture did not bind');
  config.smtpPort = address.port;
  try {
    await work();
  } finally {
    for (const socket of clients) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
const message = {
  to: 'recipient@example.test',
  subject: 'Contract test',
  text: 'Private contract body',
  category: 'invitation' as const,
};

describe('SMTP failure contracts', () => {
  it.each(['send', 'healthcheck'] as const)(
    'bounds a stalled relay response during %s',
    async (operation) => {
      config.smtpConnectionTimeoutMs = 100;
      await relay(
        () => '',
        async () => {
          const sender = new SmtpEmailSender();
          await expect(
            operation === 'send' ? sender.send(message) : sender.healthcheck(),
          ).rejects.toThrow('SMTP response timed out');
        },
      );
    },
  );

  it('never submits credentials or content when required STARTTLS is missing', async () => {
    const commands: string[] = [];
    config.smtpRequireTls = true;
    await relay(
      (line) => {
        commands.push(line);
        return '250 AUTH PLAIN\r\n';
      },
      async () => {
        await expect(new SmtpEmailSender().send(message)).rejects.toThrow('required STARTTLS');
      },
    );
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatch(/^EHLO /);
  });

  it('rejects SMTP recipient failure before sending DATA and excludes provider content from errors', async () => {
    const commands: string[] = [];
    await relay(
      (line) => {
        commands.push(line);
        if (line.startsWith('EHLO')) return '250 AUTH PLAIN\r\n';
        if (line.startsWith('AUTH')) return '235 authenticated\r\n';
        if (line.startsWith('MAIL')) return '250 sender accepted\r\n';
        return '550 provider-secret detail\r\n';
      },
      async () => {
        await expect(new SmtpEmailSender().send(message)).rejects.toMatchObject({
          message: 'SMTP command was rejected with status 550',
        });
      },
    );
    expect(commands.some((line) => line === 'DATA' || line.includes(message.text))).toBe(false);
  });

  it('rejects malformed relay replies instead of reporting accepted delivery', async () => {
    await relay(
      () => 'not an SMTP response\r\n',
      async () => {
        await expect(new SmtpEmailSender().send(message)).rejects.toThrow('malformed response');
      },
    );
  });

  it('healthcheck authenticates but never submits a message', async () => {
    const commands: string[] = [];
    await relay(
      (line) => {
        commands.push(line);
        if (line.startsWith('AUTH')) return '235 authenticated\r\n';
        if (line === 'QUIT') return '221 goodbye\r\n';
        return '250 AUTH PLAIN\r\n';
      },
      async () => {
        await expect(new SmtpEmailSender().healthcheck()).resolves.toBeUndefined();
      },
    );
    expect(commands.map((line) => line.split(' ')[0])).toEqual(['EHLO', 'AUTH', 'QUIT']);
  });
});
