import {
  createEvidenceStressFixtures,
  requireEvidenceStressDatabase,
} from './evidence-stress-fixtures';
import { evidenceConcurrency } from '../src/modules/security/evidenceConcurrency';
import { evidenceMalwareScanner } from '../src/services/evidenceMalwareScanner';
import { evidenceStorage } from '../src/services/evidenceStorage';
import { pool } from '../src/db';

async function start() {
  requireEvidenceStressDatabase(process.env);
  if (!process.send) throw Error('EVIDENCE_STRESS_IPC_REQUIRED');
  const actors = await createEvidenceStressFixtures();
  await evidenceStorage().healthcheck();
  await evidenceMalwareScanner().healthcheck();
  const { default: app } = await import('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('EVIDENCE_STRESS_SERVER_ADDRESS');
  let baseline = process.memoryUsage().rss,
    peak = baseline;
  const sampling = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 10);
  process.on('message', (message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const command = message as { type?: string; id?: number };
    if (command.type === 'snapshot' && Number.isSafeInteger(command.id)) {
      const rss = process.memoryUsage().rss;
      peak = Math.max(peak, rss);
      process.send?.({
        type: 'snapshot',
        id: command.id,
        baselineRssBytes: baseline,
        peakRssBytes: peak,
        rssBytes: rss,
        ...evidenceConcurrency.snapshot(),
      });
    }
    if (command.type === 'baseline') {
      baseline = process.memoryUsage().rss;
      peak = baseline;
    }
    if (command.type === 'stop') {
      clearInterval(sampling);
      server.close(() => {
        void pool.end().finally(() => process.exit(0));
      });
      server.closeAllConnections();
    }
  });
  process.send({ type: 'ready', port: address.port, actors });
}
void start().catch(() => {
  process.send?.({ type: 'failed', code: 'EVIDENCE_STRESS_API_START_FAILED' });
  process.exitCode = 1;
  void pool.end();
});
