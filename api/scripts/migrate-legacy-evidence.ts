import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/env';
import { pool, query } from '../src/db';
import { detectEvidenceMime } from '../src/services/evidenceFilePolicy';
import { evidenceStorage } from '../src/services/evidenceStorage';

async function migrate(): Promise<void> {
  const root = path.join(path.resolve(__dirname, '../..'), 'api', 'uploads');
  const result = await query(`SELECT id,storage_path FROM evidence_items WHERE storage_key IS NULL AND storage_provider='legacy_local' AND storage_path IS NOT NULL ORDER BY created_at`);
  let migrated = 0; let skipped = 0;
  for (const item of result.rows) {
    const legacyPath = path.resolve(item.storage_path);
    if (!legacyPath.startsWith(root + path.sep) || !fs.existsSync(legacyPath)) { skipped += 1; console.warn(`Skipped ${item.id}: legacy file is missing or outside api/uploads`); continue; }
    const content = await fs.promises.readFile(legacyPath);
    let detectedMimeType: string;
    try { detectedMimeType = detectEvidenceMime(content); }
    catch { skipped += 1; console.warn(`Skipped ${item.id}: legacy file is not a valid PDF, JPEG or PNG`); continue; }
    const objectKey = `evidence/${config.environment}/${crypto.randomUUID()}`;
    const storage = evidenceStorage();
    await storage.put(objectKey, content, detectedMimeType);
    try {
      const updated = await query(
        `UPDATE evidence_items SET storage_key=$2,storage_provider=$3,detected_mime_type=$4,mime_type=$4,
          validation_status='validated',sha256_hash=$5 WHERE id=$1 AND storage_key IS NULL`,
        [item.id, objectKey, storage.provider, detectedMimeType, `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`],
      );
      if (updated.rowCount !== 1) { await storage.delete(objectKey).catch(() => undefined); skipped += 1; continue; }
      migrated += 1;
    } catch (error) { await storage.delete(objectKey).catch(() => undefined); throw error; }
  }
  console.log(`Legacy evidence migration complete: ${migrated} migrated, ${skipped} skipped.`);
}

migrate().catch((error) => { console.error('Legacy evidence migration failed:', error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => pool.end());
