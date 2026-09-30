import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const seedSql = readFileSync(resolve(__dirname, '../../db/seed.sql'), 'utf8');

describe('seed evidence integrity', () => {
  it('does not advertise evidence whose object bytes do not exist', () => {
    expect(seedSql).not.toContain('ffffffff-ffff-ffff-ffff-fffffffffff1');
    expect(seedSql).not.toContain('ffffffff-ffff-ffff-ffff-fffffffffff2');
    expect(seedSql).not.toContain('ffffffff-ffff-ffff-ffff-fffffffffff3');
    expect(seedSql).not.toContain('evidence/2026/cert-ready.pdf');
    expect(seedSql).not.toContain('evidence/2026/weight-ready.pdf');
    expect(seedSql).not.toContain('evidence/2026/bol-0942.pdf');
  });
});
