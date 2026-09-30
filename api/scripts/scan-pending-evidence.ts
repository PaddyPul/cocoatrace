import fs from 'fs';
import path from 'path';
import { pool, query } from '../src/db';
import { evidenceMalwareScanner } from '../src/services/evidenceMalwareScanner';
import { evidenceStorage } from '../src/services/evidenceStorage';

async function contentFor(item: { storage_key?: string; storage_path?: string }): Promise<Buffer | null> {
  if (item.storage_key) return evidenceStorage().get(item.storage_key);
  if (!item.storage_path) return null;
  const uploadsRoot = path.join(path.resolve(__dirname, '../..'), 'api', 'uploads');
  const filePath = path.resolve(item.storage_path);
  if (!filePath.startsWith(uploadsRoot + path.sep) || !fs.existsSync(filePath)) return null;
  return fs.promises.readFile(filePath);
}

async function run(): Promise<void> {
  await evidenceMalwareScanner().healthcheck();
  const { rows } = await query(
    `SELECT id,storage_key,storage_path FROM evidence_items
     WHERE malware_scan_status IN ('legacy_unscanned','scan_failed') ORDER BY created_at`,
  );
  let clean = 0; let infected = 0; let failed = 0;
  for (const item of rows) {
    try {
      const content = await contentFor(item);
      if (!content) throw new Error('Stored evidence object is missing');
      const result = await evidenceMalwareScanner().scan(content);
      if (result.status === 'infected') {
        if (item.storage_key) await evidenceStorage().delete(item.storage_key);
        await query(
          `UPDATE evidence_items SET malware_scan_status='infected',malware_scanner_engine=$2,
            malware_scanned_at=NOW() WHERE id=$1`,
          [item.id, result.engine],
        );
        infected += 1;
        console.warn(`Evidence ${item.id} was rejected: ${result.signature}`);
      } else {
        await query(
          `UPDATE evidence_items SET malware_scan_status='clean',malware_scanner_engine=$2,
            malware_scanned_at=NOW() WHERE id=$1`,
          [item.id, result.engine],
        );
        clean += 1;
      }
    } catch (error) {
      await query(`UPDATE evidence_items SET malware_scan_status='scan_failed',malware_scanned_at=NOW() WHERE id=$1`, [item.id]);
      failed += 1;
      console.error(`Evidence ${item.id} scan failed:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`Pending evidence scan complete: ${clean} clean, ${infected} infected, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

run().catch((error) => { console.error('Evidence scan failed:', error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => pool.end());
