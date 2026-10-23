export function assertPreviewTarget(databaseUrl: string, environment: string, demoMode: boolean, enabled: string | undefined): void {
  const target = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.search || target.hash || (target.port && target.port !== '5432') || enabled !== 'true' || environment !== 'demo' || !demoMode || target.hostname !== 'postgres'
      || target.username !== 'preview' || target.pathname !== '/cocoatrace_demo_preview') {
    throw new Error('Preview fixtures require the dedicated preview database, demo mode and explicit preview marker');
  }
}
