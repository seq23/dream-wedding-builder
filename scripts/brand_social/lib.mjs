// Pure functions behind data/brand-social/metrics.json, the file the Boss OS Monday
// scorecard reads for the `dw-brand-social` row (boss-os
// src/shared/boss/scorecard/manifest.json, reader `repo-json`). No network here:
// scripts/brand_social/collect_metrics.mjs does the reading and hands the answers in,
// so every decision below is unit-tested (tests/unit/brand-social.test.ts).
//
// The contract the scorecard reads, on the default branch:
//   posts_published_28d  a finite number   (day-30 floor >= 8)
//   social_visits_28d    a finite number   (day-60 floor >= 1)
//   updatedAt            an ISO timestamp  no older than 9 days, else SOURCE_STALE
// A metric that could not be measured is ABSENT and `unread.<field>` says why. It is
// never written as 0: a zero nobody measured would read as "the channel is dead".

export const WINDOW_DAYS = 28;
export const MAX_AGE_DAYS = 9;
export const METRIC_FIELDS = ['posts_published_28d', 'social_visits_28d'];
export const PLATFORMS = ['instagram', 'tiktok'];
export const BEACON_ENDPOINT = '/cdn-cgi/rum'; // lib/web-analytics.ts CF_BEACON_ENDPOINT

const DAY_MS = 86_400_000;

/** The 28 calendar days ending today (UTC dates, both ends inclusive) and the same span as instants. */
export function windowFor(now) {
  const end = new Date(now);
  const until = end.toISOString().slice(0, 10);
  const since = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - (WINDOW_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
  return { days: WINDOW_DAYS, since, until, from: new Date(end.getTime() - WINDOW_DAYS * DAY_MS).toISOString(), to: end.toISOString() };
}

const cleanHost = (value) => String(value ?? '').trim().toLowerCase().replace(/\.$/, '');

/** 'instagram' | 'tiktok' | null for a refererHost, by exact hostname only. */
export function platformForReferrer(refererHost, referrers) {
  const host = cleanHost(refererHost);
  if (!host) return null;
  for (const platform of PLATFORMS) {
    if ((referrers.platforms?.[platform] ?? []).map(cleanHost).includes(host)) return platform;
  }
  return null;
}

/**
 * { host: siteTag } for the hosts asked for, from /accounts/{id}/rum/site_info/list.
 * Matched on the site's zone name (or its host, for a host-scoped site). The beacon's
 * site_token and the analytics site_tag are different values: querying by the token
 * reads an empty metric, which is why the tag is never hardcoded.
 */
export function resolveSiteTags(siteInfo, hosts) {
  const tags = {};
  for (const site of siteInfo ?? []) {
    const names = [site?.ruleset?.zone_name, site?.host].map(cleanHost).filter(Boolean);
    for (const host of hosts) {
      if (!tags[host] && site?.site_tag && names.includes(cleanHost(host))) tags[host] = site.site_tag;
    }
  }
  return tags;
}

/**
 * Per host: page loads recorded, the first date with any, and visits from Instagram and
 * TikTok. `rows` are rumPageloadEventsAdaptiveGroups groups by siteTag, refererHost, date.
 */
export function tallyVisits(rows, siteTags, referrers) {
  const hostForTag = Object.fromEntries(Object.entries(siteTags).map(([host, tag]) => [tag, host]));
  const byHost = {};
  for (const host of Object.keys(siteTags)) {
    byHost[host] = { site_tag: siteTags[host], pageloads: 0, first_pageload_date: null, social_visits: 0, by_platform: { instagram: 0, tiktok: 0 } };
  }
  for (const row of rows ?? []) {
    const host = hostForTag[row?.dimensions?.siteTag];
    if (!host) continue;
    const entry = byHost[host];
    const loads = Number(row.count ?? 0);
    const date = row.dimensions?.date ?? null;
    entry.pageloads += loads;
    if (loads > 0 && date && (!entry.first_pageload_date || date < entry.first_pageload_date)) entry.first_pageload_date = date;
    const platform = platformForReferrer(row.dimensions?.refererHost, referrers);
    if (platform) {
      const visits = Number(row.sum?.visits ?? 0);
      entry.social_visits += visits;
      entry.by_platform[platform] += visits;
    }
  }
  return byHost;
}

/**
 * The beacon payloads on a page: one entry per enabled <script> loading beacon.min.js,
 * its data-cf-beacon parsed (null when absent or unreadable). Shared with
 * scripts/validate/live-check.mjs assertion 9.
 */
export function cloudflareBeacons(html) {
  const active = String(html ?? '').replace(/<!--[\s\S]*?-->/g, '');
  return [...active.matchAll(/<script\b([^>]*)>/gi)]
    .filter((match) => /\bsrc\s*=\s*"[^"]*cloudflareinsights\.com\/beacon(?:\.min)?\.js/i.test(match[1]))
    .map((match) => {
      const raw = /\bdata-cf-beacon\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(match[1]);
      const text = raw ? (raw[1] ?? raw[2]).replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&') : null;
      try { return text ? JSON.parse(text) : null; } catch { return null; }
    });
}

/** Why a host's beacon cannot record a visit, or null when the page carries one working beacon. */
export function beaconProblem(html, expectedToken) {
  const beacons = cloudflareBeacons(html);
  if (beacons.length !== 1) return `the home page carries ${beacons.length} Cloudflare Web Analytics beacon(s), not exactly 1`;
  const beacon = beacons[0];
  if (!beacon || beacon.token !== expectedToken) return `the beacon token is ${beacon?.token ?? 'unreadable'}, not ${expectedToken}`;
  if (beacon.send?.to !== BEACON_ENDPOINT) return `the beacon posts to ${beacon.send?.to ?? 'https://cloudflareinsights.com/cdn-cgi/rum'}, which the browser blocks; nothing is recorded`;
  return null;
}

/**
 * No false zero. Visits are a number only when the beacon on the live home page can
 * record AND Cloudflare recorded at least one page load for the host in the window.
 */
export function visitsDecision({ host, beaconIssue, tally, window }) {
  if (beaconIssue) return { unread: `${host}: ${beaconIssue}` };
  if (!tally) return { unread: `${host}: Cloudflare Web Analytics has no site for this host` };
  if (tally.pageloads <= 0) return { unread: `${host}: Cloudflare recorded no page loads between ${window.since} and ${window.until}, so a zero would not be a measurement` };
  return { value: tally.social_visits };
}

/**
 * The Buffer channels that are this brand's: Instagram or TikTok, named for one of the
 * brand's own handles (read from data/seo/entity.json sameAs). The brands Buffer also
 * holds ApprovalPrep's Instagram, so service alone is not enough.
 */
export function brandChannels(channels, handles) {
  const wanted = new Set(handles.map((h) => String(h).toLowerCase().replace(/^@/, '')));
  return (channels ?? []).filter((ch) => {
    const service = String(ch?.service ?? '').toLowerCase();
    if (!PLATFORMS.includes(service)) return false;
    return [ch.name, ch.displayName].some((n) => n && wanted.has(String(n).toLowerCase().replace(/^@/, '')));
  });
}

/** The handles in a list of profile URLs (https://www.instagram.com/x/, https://www.tiktok.com/@x). */
export function socialHandles(sameAs) {
  const handles = [];
  for (const url of sameAs ?? []) {
    const m = /^https:\/\/(?:www\.)?(instagram|tiktok)\.com\/@?([A-Za-z0-9._]+)/.exec(String(url));
    if (m) handles.push({ platform: m[1], handle: m[2].toLowerCase() });
  }
  return handles;
}

/** Sent posts whose sentAt falls in the window, per platform. */
export function countSentPosts(posts, channels, window) {
  const platformOf = Object.fromEntries((channels ?? []).map((ch) => [ch.id, String(ch.service).toLowerCase()]));
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const byPlatform = { instagram: 0, tiktok: 0 };
  let total = 0;
  for (const post of posts ?? []) {
    if (String(post?.status ?? '').toLowerCase() !== 'sent') continue;
    const platform = platformOf[post.channelId];
    if (!platform) continue;
    const at = Date.parse(post.sentAt);
    if (!Number.isFinite(at) || at < from || at > to) continue;
    total += 1;
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
  }
  return { total, byPlatform };
}

/**
 * The problems with a metrics file, [] when it is one the scorecard can trust: every
 * metric is a finite number OR absent with a reason (never both, never neither),
 * updatedAt is a recent ISO time, and a visits number is backed by recorded page loads
 * on the headline host. Used by scripts/validators/validate_brand_social.mjs.
 */
export function metricsProblems(metrics, now = Date.now()) {
  const problems = [];
  if (!metrics || typeof metrics !== 'object') return ['the file is not a JSON object'];
  let checked = 0;
  for (const field of METRIC_FIELDS) {
    checked += 1;
    const has = Object.prototype.hasOwnProperty.call(metrics, field);
    const reason = metrics.unread?.[field];
    if (has && reason) problems.push(`${field} is both a number and unread ("${reason}")`);
    if (has && !(typeof metrics[field] === 'number' && Number.isFinite(metrics[field]) && metrics[field] >= 0)) problems.push(`${field} is ${JSON.stringify(metrics[field])}, not a finite count`);
    if (!has && !(typeof reason === 'string' && reason.trim())) problems.push(`${field} is missing and unread.${field} gives no reason`);
  }
  if (checked === 0) problems.push('zero fields checked');
  const at = Date.parse(metrics.updatedAt);
  if (!Number.isFinite(at) || !/^\d{4}-\d\d-\d\dT/.test(String(metrics.updatedAt))) problems.push(`updatedAt ${JSON.stringify(metrics.updatedAt)} is not an ISO time`);
  else if (at - now > DAY_MS) problems.push(`updatedAt ${metrics.updatedAt} is in the future`);
  const hosts = Object.keys(metrics.by_host ?? {});
  if (hosts.length === 0) problems.push('by_host lists zero hosts, so nothing was measured');
  if (Object.prototype.hasOwnProperty.call(metrics, 'social_visits_28d')) {
    const headline = metrics.by_host?.[metrics.headline_host];
    if (!headline) problems.push(`social_visits_28d is a number but by_host has no entry for the headline host ${metrics.headline_host}`);
    else {
      if (!(headline.pageloads > 0)) problems.push(`social_visits_28d is a number but ${metrics.headline_host} recorded ${headline.pageloads} page loads: an unmeasured zero`);
      if (headline.beacon !== 'ok') problems.push(`social_visits_28d is a number but the ${metrics.headline_host} beacon was ${JSON.stringify(headline.beacon)}, not ok`);
      if (headline.social_visits !== metrics.social_visits_28d) problems.push(`social_visits_28d is ${metrics.social_visits_28d} but by_host says ${headline.social_visits}`);
    }
  }
  return problems;
}

/** True when updatedAt is older than the scorecard allows. */
export function isStale(metrics, now = Date.now()) {
  const at = Date.parse(metrics?.updatedAt);
  return !Number.isFinite(at) || now - at > MAX_AGE_DAYS * DAY_MS;
}
