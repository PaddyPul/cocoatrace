const failures = [];
const required = ['DATABASE_URL', 'JWT_SECRET', 'WEB_URL', 'PUBLIC_WEB_URL', 'APP_VERSION'];
if (process.env.APP_ENV !== 'production') failures.push('APP_ENV must be production');
if (process.env.DEMO_MODE === 'true') failures.push('DEMO_MODE must be false');
for (const name of required) if (!process.env[name]) failures.push(`${name} is required`);
if ((process.env.JWT_SECRET || '').length < 32 || /dev_secret|change[_-]?me|password/i.test(process.env.JWT_SECRET || '')) failures.push('JWT_SECRET must be a unique non-placeholder value of at least 32 characters');
for (const name of ['WEB_URL', 'PUBLIC_WEB_URL']) if (process.env[name] && !process.env[name].startsWith('https://')) failures.push(`${name} must use HTTPS`);
if (process.env.COOKIE_SECURE !== 'true') failures.push('COOKIE_SECURE must be true');
if (Boolean(process.env.OPENAI_API_KEY) !== Boolean(process.env.OPENAI_MODEL)) failures.push('OPENAI_API_KEY and OPENAI_MODEL must be configured together');
if (failures.length) {
  console.error('Production configuration failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Production configuration passed. Runtime database and backup checks must still be verified by the deployment platform.');
