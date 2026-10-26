import type { AppConfig } from '../config/env';

/** Hosted synthetic demos use normal identity delivery, with no response bearer links. */
export function allowIdentityLinkPreview(
  config: Pick<AppConfig, 'environment' | 'demoMode'>,
): boolean {
  return config.environment === 'test' || (config.environment === 'demo' && config.demoMode);
}
