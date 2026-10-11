// Guard pinned to Lighthouse audit id `meta-description`.
// Origin (2026-10-11): Lighthouse mobile SEO scored 92 on weddingchecklistpdf.com,
// weddingseatingchartmaker.com and weddingtimelinetemplate.com, failing only
// `meta-description`, though the tag existed. Next 15 streaming metadata put
// <title>/<meta name="description"> in <head> only for user agents on its bot list
// and appended them to <body> for everyone else, Lighthouse's mobile UA included.
// next.config htmlLimitedBots now matches every UA, so metadata is always in <head>.
import { describe, expect, it } from 'vitest';
import config from '@/next.config';
import ownership from '@/data/seo/route_ownership.json';
import { hubMetadata } from '@/lib/seo';
import { HOSTS } from './helpers/site-homes';

const AUDIT_ID = 'meta-description';
const LIGHTHOUSE_MOBILE_UA = 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

describe(`Lighthouse ${AUDIT_ID}`, () => {
  it('covers all four hosts', () => { expect(HOSTS.length).toBe(4); });
  it('htmlLimitedBots matches the Lighthouse mobile UA and an ordinary browser UA', async () => {
    const resolved = await config('phase-production-build');
    const re = resolved.htmlLimitedBots as RegExp;
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test(LIGHTHOUSE_MOBILE_UA)).toBe(true);
    expect(re.test(BROWSER_UA)).toBe(true);
  });
  for (const host of HOSTS) {
    it(`${host} homepage declares a non-empty meta description`, async () => {
      const cfg = (ownership.hosts as Record<string, { root_action: string; root_target: string }>)[host];
      const md = cfg.root_action === 'render' ? (await import('@/app/page')).metadata : hubMetadata(cfg.root_target.slice(1));
      expect(String(md.description ?? '').trim().length).toBeGreaterThanOrEqual(50);
    });
  }
});
