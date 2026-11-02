import { Pool } from 'pg';
import { config } from '../src/config/env';
import { bootstrapAdmin } from '../src/modules/operations/bootstrapAdmin';
import {
  bootstrapFailureMessage,
  parseBootstrapInput,
} from '../src/modules/operations/bootstrapInput';

async function main(): Promise<void> {
  if (config.demoMode || !config.mfaEnforced || !config.cookieSecure) {
    throw new Error('Bootstrap requires normal sign-in, secure cookies and privileged MFA');
  }
  let text = '';
  for await (const chunk of process.stdin) {
    text += String(chunk);
    if (text.length > 4096) throw new Error('Bootstrap input too large');
  }
  const input = parseBootstrapInput(JSON.parse(text));
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl
      ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
      : undefined,
  });
  try {
    const client = await pool.connect();
    try {
      await bootstrapAdmin(client, input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  console.log('Private administrator created. Enroll a passkey after signing in.');
}

void main().catch((error: unknown) => {
  // Never print input, connection strings or database errors containing identity values.
  console.error(bootstrapFailureMessage(error));
  process.exitCode = 1;
});
