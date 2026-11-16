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
export const BUFFER_KEY = 'BUFFER_BRANDS_ACCESS_TOKEN';
// Why a metric is absent. `missing_key`: a key only the owner can mint (a note, the
// run stays green). `no_traffic`: the host recorded no page loads yet (a note).
// `broken`: anything else - a refused key, an outage, no matching channel, a beacon
// that cannot record - and the daily run goes red (scripts/brand_social/stop_check.mjs).
export const UNREAD_KINDS = ['missing_key', 'no_traffic', 'broken'];
// A missing key is a note only for this long, counted from the first day the file
// recorded it missing (`missing_since`). Two Mondays of the weekly scorecard: after
// that the row has been blank twice and the wait becomes a break (a red daily run,
// NAMED STOP), so a key nobody sends can never leave the row blank for ever behind a
// green job - the shape of the 33 green days the beacon was broken.
export const MISSING_KEY_GRACE_DAYS = 14;
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const ISO_DATE = /^\d{4}-\d\d-\d\d$/;

const DAY_MS = 86_400_000;
const utcDate = (now) => new Date(now).toISOString().slice(0, 10);

/**
 * { key: 'YYYY-MM-DD' } for every key still missing: the date the previous file
 * recorded, else today. A key no longer missing is dropped, so a key that arrives and
 * is lost again starts a fresh wait.
 */
export function carryMissingSince(previous, missingKeys, now) {
  const today = utcDate(now);
  const prior = previous?.missing_since && typeof previous.missing_since === 'object' ? previous.missing_since : {};
  const out = {};
  for (const key of missingKeys ?? []) {
    const was = prior[key];
    out[key] = typeof was === 'string' && ISO_DATE.test(was) && was <= today ? was : today;
  }
  return out;
}

/** Whole days from a YYYY-MM-DD date to today (UTC). */
export function daysSince(date, now) {
  return Math.floor((Date.parse(`${utcDate(now)}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);
}

/** Every listed missing key with how long it has waited, and whether it is past the grace. */
export function keyWaits(metrics, now = Date.now()) {
  const keys = Array.isArray(metrics?.missing_keys) ? metrics.missing_keys : [];
  return keys.filter((key) => ENV_NAME.test(String(key))).map((key) => {
    const since = metrics?.missing_since?.[key];
    const days = typeof since === 'string' && ISO_DATE.test(since) ? daysSince(since, now) : null;
    return { key, since: since ?? null, days, overdue: days !== null && days >= MISSING_KEY_GRACE_DAYS };
  });
}

/** The missing keys past the grace. */
export function overdueKeys(metrics, now = Date.now()) {
  return keyWaits(metrics, now).filter((wait) => wait.overdue);
}

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
  if (beaconIssue) return { unread: `${host}: ${beaconIssue}`, kind: 'broken' };
  if (!tally) return { unread: `${host}: Cloudflare Web Analytics has no site for this host`, kind: 'broken' };
  if (tally.pageloads <= 0) return { unread: `${host}: Cloudflare recorded no page loads between ${window.since} and ${window.until}, so a zero would not be a measurement`, kind: 'no_traffic' };
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

/**
 * The reason a key opened a Buffer but no channel matched: names the channels it did
 * see (service/name, at most 10), so a renamed channel is diagnosable from the file.
 */
export function noChannelReason(seen, handles) {
  const names = (seen ?? []).map((ch) => `${String(ch?.service ?? '?').toLowerCase()}/${ch?.name ?? ch?.displayName ?? '?'}`);
  const shown = names.length ? `${names.slice(0, 10).join(', ')}${names.length > 10 ? ` and ${names.length - 10} more` : ''}` : 'none';
  return `the Buffer this key opens has no Instagram or TikTok channel named ${handles.join(' or ')}; channels it sees: ${shown}`;
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
    const kind = metrics.unread_kind?.[field];
    if (!has && !UNREAD_KINDS.includes(kind)) problems.push(`${field} is missing and unread_kind.${field} is ${JSON.stringify(kind)}, not one of ${UNREAD_KINDS.join(', ')}`);
    if (has && kind !== undefined) problems.push(`${field} is a number but unread_kind.${field} is set`);
  }
  if (checked === 0) problems.push('zero fields checked');
  const missingKeys = metrics.missing_keys ?? [];
  const keyed = METRIC_FIELDS.some((f) => metrics.unread_kind?.[f] === 'missing_key');
  if (!Array.isArray(missingKeys)) problems.push('missing_keys is not a list');
  else {
    if (keyed && missingKeys.length === 0) problems.push('a metric waits on a missing key but missing_keys is empty');
    if (!keyed && missingKeys.length > 0) problems.push(`missing_keys lists ${missingKeys.join(', ')} but no metric waits on a key`);
    for (const name of missingKeys) if (!ENV_NAME.test(String(name))) problems.push(`missing_keys entry ${JSON.stringify(name)} is not a bare environment-variable name`);
    // The wait has a start date, or the grace can never run out.
    const since = metrics.missing_since ?? {};
    if (typeof since !== 'object' || Array.isArray(since)) problems.push('missing_since is not an object');
    else {
      const today = utcDate(now);
      for (const name of missingKeys) {
        const date = since[name];
        if (!(typeof date === 'string' && ISO_DATE.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)))) problems.push(`missing_keys lists ${name} but missing_since.${name} is ${JSON.stringify(date)}, not a YYYY-MM-DD date`);
        else if (date > today) problems.push(`missing_since.${name} ${date} is in the future`);
      }
      for (const name of Object.keys(since)) if (!missingKeys.includes(name)) problems.push(`missing_since names ${name}, which missing_keys does not list`);
    }
  }
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

/**
 * What the daily run should do about the unread metrics. A key the owner owes us
 * (within MISSING_KEY_GRACE_DAYS of missing_since) and a host with no traffic yet are
 * notes (green); a key past the grace, and everything else, is a break (red, NAMED
 * STOP). A file the contract rejects is reported under `problems` and also stops.
 */
export function unreadSummary(metrics, now = Date.now()) {
  const out = { missingKeys: [], breaks: [], notes: [], problems: [], checked: 0 };
  if (!metrics || typeof metrics !== 'object') { out.problems.push('the file is not a JSON object'); return out; }
  for (const field of METRIC_FIELDS) {
    out.checked += 1;
    if (Object.prototype.hasOwnProperty.call(metrics, field)) continue;
    const reason = metrics.unread?.[field] ?? 'no reason given';
    const kind = metrics.unread_kind?.[field];
    if (kind === 'missing_key') {
      const waits = keyWaits(metrics, now);
      const overdue = waits.filter((wait) => wait.overdue);
      if (overdue.length) {
        const late = overdue.map(({ key, since, days }) => `${key} has been missing ${days} days (since ${since}), past the ${MISSING_KEY_GRACE_DAYS}-day grace; clear it by emailing boss@sequoiataylor.com the line SECRET ${key}=<value>`);
        out.breaks.push({ field, reason: `${reason}. ${late.join('; ')}` });
      } else {
        const told = waits.map(({ key, since, days }) => (days === null ? `${key}: no missing_since recorded` : `${key} waiting ${days} of ${MISSING_KEY_GRACE_DAYS} day(s), since ${since}`));
        out.notes.push({ field, reason: told.length ? `${reason} (${told.join('; ')})` : reason });
      }
    } else if (kind === 'no_traffic') out.notes.push({ field, reason });
    else out.breaks.push({ field, reason });
  }
  if (Array.isArray(metrics.missing_keys)) out.missingKeys = metrics.missing_keys.filter((k) => ENV_NAME.test(String(k)));
  return out;
}

/** True when updatedAt is older than the scorecard allows. */
export function isStale(metrics, now = Date.now()) {
  const at = Date.parse(metrics?.updatedAt);
  return !Number.isFinite(at) || now - at > MAX_AGE_DAYS * DAY_MS;
}
