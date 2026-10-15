import { describe, expect, it } from 'vitest';
import { deploymentDiagnostics, readDeploymentDiagnostics } from './deployment';

const metadata = {
  schemaVersion: 1,
  gitSha: 'a'.repeat(40),
  builtAt: '2026-10-15T12:00:00.000Z',
  source: 'build-artifact',
};
describe('protected deployment metadata projection', () => {
  it('reports the supplied image commit and build timestamp independently of runtime environment', () => {
    expect(deploymentDiagnostics('staging', metadata)).toEqual({
      schemaVersion: 1,
      environment: 'staging',
      metadataStatus: 'complete',
      gitSha: metadata.gitSha,
      builtAt: metadata.builtAt,
      provenance: 'build-artifact',
    });
  });
  it.each([
    null,
    {},
    { ...metadata, gitSha: 'main' },
    { ...metadata, builtAt: 'yesterday' },
    { ...metadata, databaseUrl: 'postgres://private' },
    { ...metadata, gitSha: 'a'.repeat(41) },
  ])('rejects malformed or overbroad artifact without exposing raw fields: %j', (raw) => {
    expect(deploymentDiagnostics('production', raw)).toEqual({
      schemaVersion: 1,
      environment: 'production',
      metadataStatus: 'incomplete',
      gitSha: null,
      builtAt: null,
      provenance: 'unavailable',
    });
  });
  it('does not invent a commit for an unstamped local build', () => {
    expect(deploymentDiagnostics('development', { ...metadata, gitSha: null })).toMatchObject({
      metadataStatus: 'incomplete',
      gitSha: null,
      builtAt: metadata.builtAt,
    });
  });
  it('reads only the allowlisted build artifact projection', () => {
    expect(Object.keys(readDeploymentDiagnostics('test')).sort()).toEqual(
      ['schemaVersion', 'environment', 'metadataStatus', 'gitSha', 'builtAt', 'provenance'].sort(),
    );
  });
});
