import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('customer entry copy describes implemented records without promising blending entry', () => {
  for (const path of ['web/src/pages/LoginPage.tsx', 'web/src/pages/OnboardingPage.tsx']) {
    assert.doesNotMatch(source(path), /blending|repacking|transformations/i, path);
  }
  assert.match(source('web/src/pages/InvestorDemoPage.tsx'), /simulation uses seeded genealogy/);
  assert.match(
    source('web/src/pages/InvestorDemoPage.tsx'),
    /customer blending and repacking entry is not available/,
  );
});
