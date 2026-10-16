import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkBrandingInventory(inventory, readText, customerFiles) {
  if (
    inventory?.version !== 1 ||
    inventory.customerBrand !== 'BetterTrade' ||
    !Array.isArray(inventory.anchors) ||
    !inventory.anchors.length
  )
    throw new Error('Invalid branding compatibility inventory');
  const ids = new Set();
  for (const row of inventory.anchors) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      ids.has(row.id) ||
      typeof row.path !== 'string' ||
      path.isAbsolute(row.path) ||
      row.path.split(/[\\/]/).includes('..') ||
      !Array.isArray(row.includes) ||
      !row.includes.length ||
      !row.reason
    )
      throw new Error('Invalid or duplicate compatibility anchor');
    ids.add(row.id);
    const source = readText(row.path);
    for (const needle of row.includes) {
      if (typeof needle !== 'string' || !needle || !source.includes(needle))
        throw new Error(
          `Compatibility anchor changed: ${row.id} (${row.path}). Review BRD-003 before migrating identifiers.`,
        );
    }
  }
  for (const file of customerFiles) {
    if (readText(file).includes('CocoaTrace'))
      throw new Error(`Legacy display brand remains: ${file}`);
  }
  if (!readText('web/index.html').includes('<title>BetterTrade'))
    throw new Error('Customer page title must identify BetterTrade');
  return {
    status: 'passed',
    inventoryVersion: 1,
    compatibilityAnchors: ids.size,
    customerFiles: customerFiles.length,
  };
}
function sourceFiles(root, directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = directory + '/' + entry.name;
    return entry.isDirectory()
      ? sourceFiles(root, file)
      : /\.(tsx?|html)$/.test(entry.name)
        ? [file]
        : [];
  });
}
export function checkRepositoryBranding(root) {
  const inventory = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/branding/compatibility-v1.json'), 'utf8'),
  );
  const files = [
    ...sourceFiles(root, 'web/src'),
    'web/index.html',
    'api/src/services/emailSender.ts',
    'api/src/modules/payments/reminders.ts',
    'api/src/modules/recall/notifications.ts',
  ];
  return checkBrandingInventory(
    inventory,
    (file) => fs.readFileSync(path.join(root, file), 'utf8'),
    files,
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(
      JSON.stringify(checkRepositoryBranding(fileURLToPath(new URL('../', import.meta.url)))),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
