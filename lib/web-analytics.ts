import tokens from '@/data/cf_web_analytics.json';

export const CF_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** The Cloudflare Web Analytics site token for a canonical host, or null for any other host. */
export function webAnalyticsToken(host: string): string | null {
  const value = (tokens as Record<string, string>)[host];
  return host !== '_comment' && typeof value === 'string' && /^[0-9a-f]{32}$/.test(value) ? value : null;
}
