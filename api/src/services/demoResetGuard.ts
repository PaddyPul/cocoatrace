export function assertDemoResetAllowed(connectionString: string, nodeEnv = process.env.NODE_ENV): void {
  if (nodeEnv === 'production') {
    throw new Error('Demo reset is disabled when NODE_ENV=production.');
  }
  const url = new URL(connectionString);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const recognizedName = /^(cocoatrace|cocoatrace_demo|cocoatrace_test)$/.test(url.pathname.slice(1));
  const explicit = process.env.COCOATRACE_ALLOW_REMOTE_DEMO_RESET === 'I_UNDERSTAND';
  if ((!local || !recognizedName) && !explicit) {
    throw new Error(
      `Refusing to reset ${url.hostname}/${url.pathname.slice(1)}. ` +
      'Use a recognized local demo database or set COCOATRACE_ALLOW_REMOTE_DEMO_RESET=I_UNDERSTAND explicitly.',
    );
  }
}

