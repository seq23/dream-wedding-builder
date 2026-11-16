import { describe, expect, it } from 'vitest';
import {
  beaconProblem, brandChannels, BUFFER_KEY, cloudflareBeacons, countSentPosts, isStale, METRIC_FIELDS, metricsProblems,
  noChannelReason, platformForReferrer, resolveSiteTags, socialHandles, tallyVisits, unreadSummary, visitsDecision, windowFor
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
    // per field: no reason, and no kind
    expect(metricsProblems({ ...base, unread: {} }, NOW).length).toBe(2 * METRIC_FIELDS.length);
    expect(metricsProblems({ ...base, unread: { posts_published_28d: 'no key', social_visits_28d: 'no loads' }, unread_kind: { posts_published_28d: 'missing_key', social_visits_28d: 'no_traffic' }, missing_keys: [BUFFER_KEY] }, NOW)).toEqual([]);
  });

  it('visits are a number only with a live beacon and recorded page loads', () => {
    const tally = { pageloads: 12, social_visits: 0 };
    expect(visitsDecision({ host: 'a.com', beaconIssue: null, tally, window })).toEqual({ value: 0 });
    expect(visitsDecision({ host: 'a.com', beaconIssue: 'cross-origin', tally, window })).toMatchObject({ kind: 'broken' });
    expect(visitsDecision({ host: 'a.com', beaconIssue: null, tally: { pageloads: 0, social_visits: 0 }, window })).toMatchObject({ kind: 'no_traffic' });
    expect(visitsDecision({ host: 'a.com', beaconIssue: null, tally: undefined, window })).toMatchObject({ kind: 'broken' });
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

describe('a wait is a note, a break is a stop', () => {
  const base = { updatedAt: new Date(NOW).toISOString(), headline_host: 'a.com', social_visits_28d: 1, by_host: { 'a.com': { pageloads: 5, beacon: 'ok', social_visits: 1 } } };
  const absentPosts = (kind: string, missing_keys: string[] = []) => ({ ...base, unread: { posts_published_28d: 'why' }, unread_kind: { posts_published_28d: kind }, missing_keys });

  it.each([
    ['missing_key', [BUFFER_KEY], 'notes'],
    ['no_traffic', [], 'notes'],
    ['broken', [], 'breaks']
  ])('an absent metric of kind %s is filed under %s', (kind, keys, bucket) => {
    const file = absentPosts(kind, keys);
    expect(metricsProblems(file, NOW)).toEqual([]);
    const summary = unreadSummary(file);
    expect(summary[bucket as 'notes' | 'breaks'].map((e) => e.field)).toEqual(['posts_published_28d']);
    expect(summary[bucket === 'notes' ? 'breaks' : 'notes']).toEqual([]);
    expect(summary.checked).toBe(METRIC_FIELDS.length);
  });

  it('an absent metric with no kind is a break, never a quiet note', () => {
    const file = { ...base, unread: { posts_published_28d: 'why' } };
    expect(unreadSummary(file).breaks).toHaveLength(1);
    expect(metricsProblems(file, NOW).length).toBeGreaterThan(0);
  });

  it('lists the missing key, and nothing when every metric is read', () => {
    expect(unreadSummary(absentPosts('missing_key', [BUFFER_KEY])).missingKeys).toEqual([BUFFER_KEY]);
    const read = { ...base, posts_published_28d: 3, unread: {}, unread_kind: {}, missing_keys: [] };
    expect(unreadSummary(read)).toMatchObject({ breaks: [], notes: [], missingKeys: [] });
  });

  it('rejects each malformed waiting file', () => {
    expect(metricsProblems(absentPosts('later'), NOW).length).toBeGreaterThan(0);
    expect(metricsProblems(absentPosts('missing_key', []), NOW).length).toBeGreaterThan(0);
    expect(metricsProblems(absentPosts('missing_key', ['the Buffer token']), NOW).length).toBeGreaterThan(0);
    expect(metricsProblems(absentPosts('broken', [BUFFER_KEY]), NOW).length).toBeGreaterThan(0);
    expect(metricsProblems({ ...base, posts_published_28d: 2, unread: {}, unread_kind: { posts_published_28d: 'broken' } }, NOW).length).toBeGreaterThan(0);
  });

  it('a key that opens a Buffer with no brand channel names the channels it saw', () => {
    const seen = [{ service: 'instagram', name: 'porchandparty901' }, { service: 'tiktok', name: 'iamcindymercer' }];
    const reason = noChannelReason(seen, ['dreamweddingbuilder']);
    expect(reason).toContain('instagram/porchandparty901');
    expect(reason).toContain('tiktok/iamcindymercer');
    const many = Array.from({ length: 13 }, (_, i) => ({ service: 'instagram', name: `c${i}` }));
    expect(noChannelReason(many, ['x'])).not.toContain('c10');
  });
});
