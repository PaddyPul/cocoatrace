import { AppEnvironment, config } from '../config/env';

export function assertDemoResetAllowed(
  connectionString: string,
  environment: AppEnvironment = config.environment,
  demoMode = config.demoMode,
  allowRemote = config.allowRemoteDemoReset,
): void {
  if (environment === 'production' || environment === 'staging') {
    throw new Error(`Demo reset is disabled in ${environment}.`);
  }
  if (!demoMode) {
    throw new Error('Demo reset requires DEMO_MODE=true.');
  }
  const url = new URL(connectionString);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const recognizedName = /^(cocoatrace|cocoatrace_demo|cocoatrace_test)$/.test(url.pathname.slice(1));
  if ((!local || !recognizedName) && !allowRemote) {
    throw new Error(
      `Refusing to reset ${url.hostname}/${url.pathname.slice(1)}. ` +
      'Use a recognized local demo database or set COCOATRACE_ALLOW_REMOTE_DEMO_RESET=I_UNDERSTAND explicitly.',
    );
  }
}
