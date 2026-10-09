import { describe, expect, it } from 'vitest';
import { webAnalyticsToken } from '@/lib/web-analytics';
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
