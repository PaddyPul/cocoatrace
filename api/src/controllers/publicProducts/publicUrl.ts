import { config } from '../../config/env';

export function publicProductUrl(slug: string): string {
  return `${config.publicWebUrl}/p/${slug}`;
}
