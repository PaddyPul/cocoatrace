import { AppEnvironment, config } from '../config/env';

export function assertDemoResetAllowed(
  connectionString: string,
  environment: AppEnvironment = config.environment,
  demoMode = config.demoMode,
  _allowRemote = config.allowRemoteDemoReset,
): void {
  if (environment === 'production' || environment === 'staging') {
    throw new Error(`Demo reset is disabled in ${environment}.`);
  }
  if (!demoMode) {
    throw new Error('Demo reset requires DEMO_MODE=true.');
  }
  const url = new URL(connectionString);
  // The legacy override argument is retained for callers, but can never bypass target safety.
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error(
      'Refusing demo reset: use a simple local PostgreSQL URL without query or fragment overrides.',
    );
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const recognizedName = /^(cocoatrace|cocoatrace_demo|cocoatrace_test)$/.test(
    url.pathname.slice(1),
  );
  if (!local || !recognizedName) {
    throw new Error(
      `Refusing to reset ${url.hostname}/${url.pathname.slice(1)}. ` +
        'Only recognized local demo databases are permitted; remote overrides cannot bypass this guard.',
    );
  }
}
