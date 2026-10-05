import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Tokenize the small, static command language used by package scripts. Never
// execute a script while checking it: migrations and demo resets have effects.
export function commandTokens(command) {
  const tokens = [];
  let token = '';
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) quote = null;
      else token += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '&' || character === '|' || character === ';') {
      if (token) tokens.push(token);
      token = '';
      if (command[index + 1] === character) index += 1;
      tokens.push(';');
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = '';
    } else {
      token += character;
    }
  }
  if (quote) throw new Error('Unterminated command quote');
  if (token) tokens.push(token);
  return tokens;
}

function entryPointExists(directory, entryPoint) {
  const normalized = entryPoint.replaceAll('\\', '/');
  const entry = path.resolve(directory, normalized);
  if (fs.existsSync(entry) && fs.statSync(entry).isFile()) return true;
  // Build output is intentionally absent in a clean checkout. Verify its source
  // contract instead; the separate build gate verifies emitted runtime files.
  if (normalized.startsWith('dist/') && /\.[cm]?js$/.test(normalized)) {
    const source = normalized.replace(/^dist\//, 'src/').replace(/\.[cm]?js$/, '.ts');
    return fs.existsSync(path.resolve(directory, source));
  }
  return false;
}

export function checkScriptContracts(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const workspacePaths = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : (rootPackage.workspaces?.packages ?? []);
  const packages = [{ directory: root, manifest: rootPackage }];
  const errors = [];
  for (const workspace of workspacePaths) {
    // Explicit workspaces keep resolution deterministic. Do not silently omit a
    // newly introduced glob: update the checker if the workspace model changes.
    if (/[*?]/.test(workspace)) {
      errors.push(`Unsupported workspace pattern: ${workspace}`);
      continue;
    }
    try {
      const directory = path.join(root, workspace);
      packages.push({
        directory,
        workspace,
        manifest: JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')),
      });
    } catch {
      errors.push(`Missing or invalid workspace manifest: ${workspace}`);
    }
  }
  for (const pkg of packages) {
    for (const [name, command] of Object.entries(pkg.manifest.scripts ?? {})) {
      const label = `${pkg.manifest.name ?? pkg.workspace ?? 'root'}:${name}`;
      if (name === 'db:migrate:js' || name === 'db:seed:js') {
        errors.push(`${label}: obsolete alias; use the supported TypeScript runner`);
      }
      let tokens;
      try {
        tokens = commandTokens(command);
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
        continue;
      }
      const segments = [];
      let segment = [];
      for (const token of [...tokens, ';']) {
        if (token === ';') {
          if (segment.length) segments.push(segment);
          segment = [];
        } else segment.push(token);
      }
      for (const part of segments) {
        const binary = part[0];
        if (binary === 'node' || binary === 'tsx') {
          // Inline code is not a file entry point. Options with separate values
          // must not be mistaken for the program (e.g. node --import tsx).
          if (
            part.includes('-e') ||
            part.includes('--eval') ||
            part.includes('-p') ||
            part.includes('--print')
          )
            continue;
          const optionsWithValues = new Set([
            '--import',
            '--require',
            '-r',
            '--loader',
            '--conditions',
            '--inspect-port',
          ]);
          for (let index = 1; index < part.length; index += 1) {
            const argument = part[index];
            if (optionsWithValues.has(argument)) {
              index += 1;
              continue;
            }
            if (argument.startsWith('-') || argument === 'watch') continue;
            if (!entryPointExists(pkg.directory, argument))
              errors.push(`${label}: missing local entry point ${argument}`);
            // All additional arguments belong to the program, except node's
            // explicit test mode, which accepts multiple test file entry points.
            if (!part.includes('--test')) break;
          }
        }
        if (binary === 'npm' && ['run', 'run-script'].includes(part[1])) {
          const targetScript = part[2];
          const option = part.find((argument) => argument.startsWith('--workspace='));
          const workspaceIndex = part.findIndex(
            (argument) => argument === '--workspace' || argument === '-w',
          );
          const workspace =
            option?.slice('--workspace='.length) ??
            (workspaceIndex >= 0 ? part[workspaceIndex + 1] : undefined);
          const target =
            workspace === undefined
              ? pkg
              : packages.find(
                  (candidate) =>
                    candidate.workspace === workspace || candidate.manifest.name === workspace,
                );
          if (!target) errors.push(`${label}: unknown workspace ${workspace}`);
          else if (!Object.hasOwn(target.manifest.scripts ?? {}, targetScript))
            errors.push(
              `${label}: missing delegated script ${workspace ?? pkg.manifest.name}:${targetScript}`,
            );
        }
      }
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const errors = checkScriptContracts(root);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else
    console.log(
      'Package script contracts passed: local runners and workspace delegations resolve.',
    );
}
