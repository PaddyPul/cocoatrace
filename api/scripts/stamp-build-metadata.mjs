import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supplied = process.env.BUILD_GIT_SHA?.trim();
if (supplied && !/^[0-9a-f]{40}$/.test(supplied)) {
  throw new Error('BUILD_GIT_SHA must be a full lowercase 40-character Git commit SHA');
}
const metadata = {
  schemaVersion: 1,
  gitSha: supplied || null,
  builtAt: new Date().toISOString(),
  source: 'build-artifact',
};
fs.mkdirSync(path.join(apiRoot, 'dist'), { recursive: true });
fs.writeFileSync(path.join(apiRoot, 'dist/build-metadata.json'), JSON.stringify(metadata) + '\n');
