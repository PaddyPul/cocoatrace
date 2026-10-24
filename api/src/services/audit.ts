import { compareOrdinal } from '../utils/ordinal';
import crypto from 'crypto';

function hashObject(obj: Record<string, unknown>): string {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort(compareOrdinal));
  return 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export { hashObject };
