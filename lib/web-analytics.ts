import tokens from '@/data/cf_web_analytics.json';

export const CF_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/**
 * Where the beacon posts its page loads: this host's own edge, not cloudflareinsights.com.
 *
 * beacon.min.js picks its endpoint as
 *   `send.to ?? (version === undefined ? 'https://cloudflareinsights.com/cdn-cgi/rum' : '/cdn-cgi/rum')`.
 * Given only a token it posts cross-origin, Chromium blocks that on CORS, and from
 * 8 Oct 2026 (commit caf7133) to 9 Nov 2026 every page load on the four wedding hosts
 * was discarded. `send.to` is read first, so naming the endpoint does not depend on that
 * heuristic. The measurement is in docs/analytics/web-analytics-beacon.md; the live
 * guard is assertion 9 in scripts/validate/live-check.mjs.
 */
export const CF_BEACON_ENDPOINT = '/cdn-cgi/rum';

/** The Cloudflare Web Analytics site token for a canonical host, or null for any other host. */
export function webAnalyticsToken(host: string): string | null {
  const value = (tokens as Record<string, string>)[host];
  return host !== '_comment' && typeof value === 'string' && /^[0-9a-f]{32}$/.test(value) ? value : null;
}

/** The `data-cf-beacon` payload: this host's token, posting to the same origin. */
export function beaconPayload(token: string): { token: string; send: { to: string } } {
  return { token, send: { to: CF_BEACON_ENDPOINT } };
}
