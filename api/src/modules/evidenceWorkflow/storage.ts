import fs from 'fs';
import path from 'path';
import { evidenceStorage, readBoundedEvidenceFile } from '../../services/evidenceStorage';
import { DownloadEvidenceItem } from './policy';

// Same api/uploads root in source and compiled layouts as the original controller.
export const legacyUploadsRoot = path.resolve(__dirname, '../../../uploads');
export function containedLegacyPath(storedPath: string): string | undefined {
  const filePath = path.resolve(storedPath);
  return filePath.startsWith(legacyUploadsRoot + path.sep) ? filePath : undefined;
}
export async function readEvidenceContent(item: DownloadEvidenceItem): Promise<Buffer | null> {
  if (item.storage_key) return evidenceStorage().get(item.storage_key);
  if (item.storage_provider === 'legacy_local' && item.storage_path) {
    const filePath = containedLegacyPath(item.storage_path);
    if (filePath && fs.existsSync(filePath)) return readBoundedEvidenceFile(filePath);
  }
  return null;
}
