import { describe, expect, it } from 'vitest';
import { beaconPayload, CF_BEACON_ENDPOINT, webAnalyticsToken } from '@/lib/web-analytics';
import { CANONICAL_HOSTS } from '@/lib/site-config';

describe('Cloudflare Web Analytics tokens', () => {
  it('every canonical host has its own 32-hex site token', () => {
    const tokens = CANONICAL_HOSTS.map((host) => webAnalyticsToken(host));
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(new Set(tokens).size).toBe(CANONICAL_HOSTS.length);
  });

  it('non-canonical hosts get no beacon', () => {
    expect(webAnalyticsToken('localhost')).toBeNull();
    expect(webAnalyticsToken('_comment')).toBeNull();
  });
});

describe('Cloudflare Web Analytics beacon payload', () => {
  // A bare { token } makes beacon.min.js post to https://cloudflareinsights.com/cdn-cgi/rum,
  // which the browser blocks on CORS: 33 days of page loads were lost that way.
  it('posts to the same origin, never cross-origin', () => {
    const payload = beaconPayload('d63c875fa19e4a78b942f04cfb3873fe');
    expect(payload.send.to).toBe('/cdn-cgi/rum');
    expect(payload.send.to.startsWith('/')).toBe(true);
    expect(CF_BEACON_ENDPOINT).not.toMatch(/^https?:/);
  });

  it('carries the host token unchanged', () => {
    for (const host of CANONICAL_HOSTS) {
      const token = webAnalyticsToken(host)!;
      expect(JSON.parse(JSON.stringify(beaconPayload(token)))).toEqual({ token, send: { to: '/cdn-cgi/rum' } });
    }
  });
});
