import path from 'path';
import { DemoScenario, resetAndSeed } from './demo-data';

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const scenario = (process.argv[2] || 'incident') as DemoScenario;
if (!['fresh', 'commercial', 'incident'].includes(scenario)) {
  console.error('Usage: npm run demo:seed:fresh|commercial|incident');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || 'postgresql://cocoa:cocoa_dev@127.0.0.1:15433/cocoatrace';

resetAndSeed(scenario, connectionString)
  .then(() => console.log(`✓ Demo database reset to the ${scenario} scenario`))
  .catch((error) => {
    console.error(`Demo reset failed: ${(error as Error).message}`);
    process.exit(1);
  });

