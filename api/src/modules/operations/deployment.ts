import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { AppEnvironment } from '../../config/env';

const metadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    gitSha: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .nullable(),
    builtAt: z.string().datetime(),
    source: z.literal('build-artifact'),
  })
  .strict();

export function deploymentDiagnostics(environment: AppEnvironment, raw: unknown) {
  const parsed = metadataSchema.safeParse(raw);
  const artifact = parsed.success ? parsed.data : null;
  return {
    schemaVersion: 1,
    environment,
    metadataStatus: artifact?.gitSha ? 'complete' : 'incomplete',
    gitSha: artifact?.gitSha ?? null,
    builtAt: artifact?.builtAt ?? null,
    provenance: artifact ? 'build-artifact' : 'unavailable',
  };
}

export function readDeploymentDiagnostics(environment: AppEnvironment) {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../build-metadata.json'), 'utf8'));
  } catch {
    raw = null;
  }
  return deploymentDiagnostics(environment, raw);
}
