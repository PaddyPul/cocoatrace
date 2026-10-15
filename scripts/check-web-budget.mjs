import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Transfer budget includes every statically imported JavaScript chunk, once each.
// Lazy route chunks are measured separately; this is not a mobile latency claim.
export const initialJavaScriptBudgetBytes = 90 * 1024;
export function measureInitialJavaScript(manifest, readAsset) {
  const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry);
  if (entries.length !== 1) throw new Error('Expected one production entry');
  const seen = new Set();
  const assets = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk || typeof chunk.file !== 'string' || !chunk.file.endsWith('.js')) {
      throw new Error('Missing JavaScript manifest chunk');
    }
    if (!assets.has(chunk.file)) assets.add(chunk.file);
    for (const dependency of chunk.imports ?? []) visit(dependency);
  }
  visit(entries[0][0]);
  let rawBytes = 0;
  let gzipBytes = 0;
  for (const asset of assets) {
    const bytes = readAsset(asset);
    rawBytes += bytes.length;
    gzipBytes += gzipSync(bytes).length;
  }
  return {
    initialChunks: assets.size,
    rawBytes,
    gzipBytes,
    budgetBytes: initialJavaScriptBudgetBytes,
  };
}
export function enforceInitialJavaScriptBudget(result) {
  if (result.gzipBytes > initialJavaScriptBudgetBytes) {
    throw new Error(
      `Initial JavaScript exceeds ${initialJavaScriptBudgetBytes} gzip bytes: ${result.gzipBytes}`,
    );
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../web/dist/', import.meta.url));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.vite/manifest.json'), 'utf8'));
  const result = measureInitialJavaScript(manifest, (asset) => {
    const resolved = path.resolve(root, asset);
    if (!resolved.startsWith(root)) throw new Error('Asset escapes production output');
    return fs.readFileSync(resolved);
  });
  enforceInitialJavaScriptBudget(result);
  console.log(JSON.stringify({ status: 'passed', ...result }));
}
