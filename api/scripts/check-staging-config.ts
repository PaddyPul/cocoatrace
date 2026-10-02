import { config } from '../src/config/env';
import { stagingReadinessFailures } from '../src/config/stagingReadiness';
const failures = stagingReadinessFailures(config);
if (failures.length) {
  console.error('Staging configuration failed:\n- ' + failures.join('\n- '));
  process.exitCode = 1;
} else {
  console.log('Staging configuration passed. Verify private networking, DNS/HTTPS, actual email delivery, encrypted storage and a real restore before inviting users.');
}
