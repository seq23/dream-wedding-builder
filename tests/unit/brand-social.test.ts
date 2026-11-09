import { describe, expect, it } from 'vitest';
import {
  beaconProblem, brandChannels, cloudflareBeacons, countSentPosts, isStale, METRIC_FIELDS, metricsProblems,
  platformForReferrer, resolveSiteTags, socialHandles, tallyVisits, visitsDecision, windowFor
} from '../../scripts/brand_social/lib.mjs';
import referrers from '../../data/brand-social/social_referrers.json';
import entity from '../../data/seo/entity.json';

const NOW = Date.parse('2026-11-09T12:00:00Z');
const window = windowFor(NOW);
const TOKEN = 'd63c875fa19e4a78b942f04cfb3873fe';
const page = (payload: string) => `<html><body><script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="${payload}"></script></body></html>`;

describe('the scorecard contract', () => {
  it('names the three fields boss-os reads', () => {
    expect(METRIC_FIELDS).toEqual(['posts_published_28d', 'social_visits_28d']);
    expect(metricsProblems({ posts_published_28d: 3, social_visits_28d: 1, updatedAt: new Date(NOW).toISOString(), headline_host: 'a.com', unread: {}, by_host: { 'a.com': { pageloads: 5, beacon: 'ok', social_visits: 1 } } }, NOW)).toEqual([]);
  });

  it('a window is 28 calendar days ending today', () => {
    expect(window).toMatchObject({ days: 28, since: '2026-10-13', until: '2026-11-09' });
  });

  it('staleness is the scorecard 9 days', () => {
    expect(isStale({ updatedAt: '2026-11-01T12:00:00Z' }, NOW)).toBe(false);
    expect(isStale({ updatedAt: '2026-10-30T11:00:00Z' }, NOW)).toBe(true);
    expect(isStale({}, NOW)).toBe(true);
  });
});

describe('no false zero', () => {
  it('rejects a visits zero nobody measured', () => {
    const problems = metricsProblems({ posts_published_28d: 0, social_visits_28d: 0, updatedAt: new Date(NOW).toISOString(), headline_host: 'a.com', unread: {}, by_host: { 'a.com': { pageloads: 0, beacon: 'the beacon posts cross-origin', social_visits: 0 } } }, NOW);
    expect(problems.join('\n')).toMatch(/unmeasured zero/);
    expect(problems.join('\n')).toMatch(/beacon/);
  });

  it('rejects a missing metric with no reason, and accepts it with one', () => {
    const base = { updatedAt: new Date(NOW).toISOString(), headline_host: 'a.com', by_host: { 'a.com': { pageloads: 0, beacon: 'x', social_visits: 0 } } };
    expect(metricsProblems({ ...base, unread: {} }, NOW).length).toBe(2);
    expect(metricsProblems({ ...base, unread: { posts_published_28d: 'no key', social_visits_28d: 'no loads' } }, NOW)).toEqual([]);
  });

  it('visits are a number only with a live beacon and recorded page loads', () => {
    const tally = { pageloads: 12, social_visits: 0 };
    expect(visitsDecision({ host: 'a.com', beaconIssue: null, tally, window })).toEqual({ value: 0 });
    expect(visitsDecision({ host: 'a.com', beaconIssue: 'cross-origin', tally, window })).toHaveProperty('unread');
    expect(visitsDecision({ host: 'a.com', beaconIssue: null, tally: { pageloads: 0, social_visits: 0 }, window })).toHaveProperty('unread');
    expect(visitsDecision({ host: 'a.com', beaconIssue: null, tally: undefined, window })).toHaveProperty('unread');
  });
});

describe('the beacon on the page', () => {
  it('a bare token is the cross-origin defect', () => {
    expect(beaconProblem(page(`{&quot;token&quot;:&quot;${TOKEN}&quot;}`), TOKEN)).toMatch(/cloudflareinsights\.com/);
  });
  it('the same-origin payload passes', () => {
    expect(beaconProblem(page(`{&quot;token&quot;:&quot;${TOKEN}&quot;,&quot;send&quot;:{&quot;to&quot;:&quot;/cdn-cgi/rum&quot;}}`), TOKEN)).toBeNull();
  });
  it('a wrong token, no beacon or two beacons fail', () => {
    const good = page(`{&quot;token&quot;:&quot;${TOKEN}&quot;,&quot;send&quot;:{&quot;to&quot;:&quot;/cdn-cgi/rum&quot;}}`);
    expect(beaconProblem(good, 'f'.repeat(32))).toMatch(/token/);
    expect(beaconProblem('<html></html>', TOKEN)).toMatch(/0 Cloudflare/);
    expect(beaconProblem(good + good, TOKEN)).toMatch(/2 Cloudflare/);
    expect(cloudflareBeacons(`<!-- ${good} -->`)).toHaveLength(0);
  });
});

describe('visits tally', () => {
  it('matches referrers by exact hostname only', () => {
    expect(platformForReferrer('l.instagram.com', referrers)).toBe('instagram');
    expect(platformForReferrer('WWW.TIKTOK.COM.', referrers)).toBe('tiktok');
    expect(platformForReferrer('instagram.com.evil.example', referrers)).toBeNull();
    expect(platformForReferrer('pinterest.com', referrers)).toBeNull();
    expect(platformForReferrer('', referrers)).toBeNull();
  });

  it('resolves site tags by zone name, never by token', () => {
    const list = [{ site_tag: 'tagA', site_token: TOKEN, ruleset: { zone_name: 'weddingchecklistpdf.com' } }, { site_tag: 'tagB', ruleset: { zone_name: 'other.com' } }];
    expect(resolveSiteTags(list, ['weddingchecklistpdf.com', 'missing.com'])).toEqual({ 'weddingchecklistpdf.com': 'tagA' });
  });

  it('sums social visits per host and platform, and counts every page load', () => {
    const rows = [
      { count: 10, sum: { visits: 4 }, dimensions: { siteTag: 'tagA', refererHost: 'l.instagram.com', date: '2026-11-08' } },
      { count: 3, sum: { visits: 2 }, dimensions: { siteTag: 'tagA', refererHost: 'vt.tiktok.com', date: '2026-11-09' } },
      { count: 50, sum: { visits: 20 }, dimensions: { siteTag: 'tagA', refererHost: 'google.com', date: '2026-11-07' } },
      { count: 7, sum: { visits: 7 }, dimensions: { siteTag: 'tagB', refererHost: 'instagram.com', date: '2026-11-09' } },
      { count: 9, sum: { visits: 9 }, dimensions: { siteTag: 'unknown', refererHost: 'instagram.com', date: '2026-11-09' } }
    ];
    const tally = tallyVisits(rows, { 'weddingchecklistpdf.com': 'tagA', 'weddingbudgetspreadsheet.com': 'tagB' }, referrers);
    expect(tally['weddingchecklistpdf.com']).toMatchObject({ pageloads: 63, social_visits: 6, first_pageload_date: '2026-11-07', by_platform: { instagram: 4, tiktok: 2 } });
    expect(tally['weddingbudgetspreadsheet.com']).toMatchObject({ pageloads: 7, social_visits: 7 });
  });
});

describe('posts', () => {
  const handles = socialHandles(entity.brand.sameAs).map((h) => h.handle);

  it('reads the brand handles from entity.json', () => {
    expect(handles).toContain('dreamweddingbuilder');
  });

  it('keeps only the brand Instagram and TikTok channels, not another brand in the same Buffer', () => {
    const channels = [
      { id: 'ig', name: 'dreamweddingbuilder', service: 'instagram' },
      { id: 'tt', name: '@DreamWeddingBuilder', service: 'tiktok' },
      { id: 'ap', name: 'approvalprep', service: 'instagram' },
      { id: 'pin', name: 'dreamweddingbuilder', service: 'pinterest' }
    ];
    expect(brandChannels(channels, handles).map((c) => c.id)).toEqual(['ig', 'tt']);
  });

  it('counts sent posts on sentAt inside the 28 days, and a real zero is zero', () => {
    const channels = [{ id: 'ig', service: 'instagram' }, { id: 'tt', service: 'tiktok' }];
    const posts = [
      { channelId: 'ig', status: 'sent', sentAt: '2026-11-08T10:00:00Z' },
      { channelId: 'tt', status: 'sent', sentAt: '2026-10-20T10:00:00Z' },
      { channelId: 'tt', status: 'sent', sentAt: '2026-10-01T10:00:00Z' },
      { channelId: 'ig', status: 'scheduled', sentAt: null },
      { channelId: 'ap', status: 'sent', sentAt: '2026-11-08T10:00:00Z' }
    ];
    expect(countSentPosts(posts, channels, window)).toEqual({ total: 2, byPlatform: { instagram: 1, tiktok: 1 } });
    expect(countSentPosts([], channels, window)).toEqual({ total: 0, byPlatform: { instagram: 0, tiktok: 0 } });
  });
});
