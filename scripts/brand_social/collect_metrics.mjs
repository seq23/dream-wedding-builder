#!/usr/bin/env node
// Daily: writes data/brand-social/metrics.json, the file the Boss OS Monday scorecard
// reads for the `dw-brand-social` row (posts published through Buffer and site visits
// from Instagram or TikTok, 28 days). Run by .github/workflows/brand-social-metrics.yml.
//
//   posts_published_28d  sent posts on Dream Wedding's Instagram and TikTok channels in
//                        the brands Buffer (api.buffer.com/graphql), counted on sentAt.
//                        Needs BUFFER_BRANDS_ACCESS_TOKEN; without it the field is absent
//                        and unread.posts_published_28d says so.
//   social_visits_28d    visits to weddingchecklistpdf.com (and www) whose referrer
//                        hostname is Instagram's or TikTok's
//                        (data/brand-social/social_referrers.json), from Cloudflare Web
//                        Analytics through the account GraphQL API. The other three
//                        wedding hosts are recorded under by_host, not added in.
//
// Rule 0. A NAMED STOP and exit 1, and no file written, when Cloudflare cannot be read
// at all (credentials missing or refused, zero hosts, zero site tags). A metric that
// cannot be measured while the rest can is ABSENT with a reason under `unread`, never
// a 0: visits are a number only when the live home page carries a beacon that can
// record (lib.mjs beaconProblem) and Cloudflare holds at least one page load for the
// host in the window. A real 0 from Buffer is written as 0. updatedAt is written on
// every run, so the scorecard's 9-day staleness check never trips on a working job.
//
// `--prove` (npm run brand-social:prove, after a deploy): the same reads, nothing
// written; prints each host's beacon and page loads and exits 1 unless every host's
// live beacon can record.
//
// Read-only everywhere except the one file it writes. Docs:
// docs/analytics/web-analytics-beacon.md.
import fs from 'node:fs';
import path from 'node:path';
import {
  beaconProblem, brandChannels, countSentPosts, resolveSiteTags, socialHandles, tallyVisits, visitsDecision, windowFor
} from './lib.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data/brand-social/metrics.json');
const UA = 'Mozilla/5.0 (compatible; DreamWeddingBuilder-brand-social/1.0; +https://weddingchecklistpdf.com/)';
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const referrers = readJson('data/brand-social/social_referrers.json');
const tokens = readJson('data/cf_web_analytics.json');
const hosts = Object.keys(readJson('data/seo/route_ownership.json').hosts ?? {});
const entity = readJson('data/seo/entity.json');
const handles = [...new Set(socialHandles(entity.brand?.sameAs).map((h) => h.handle))];
const headline = referrers.headline_host;
const now = new Date();
const window = windowFor(now);

function namedStop(code, why) {
  const line = `NAMED STOP ${code}: ${why} Nothing was written; data/brand-social/metrics.json keeps its last good values.`;
  console.error(line);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Brand social metrics\n\n${line}\n`);
  process.exit(1);
}

if (hosts.length === 0) namedStop('BRAND_SOCIAL_NO_HOSTS', 'data/seo/route_ownership.json declares zero hosts.');
if (!hosts.includes(headline)) namedStop('BRAND_SOCIAL_NO_HOSTS', `the headline host ${headline} is not a canonical host.`);

// ── Visits: Cloudflare Web Analytics ────────────────────────────────────────────
const { CLOUDFLARE_API_TOKEN: cfToken, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!cfToken || !account) namedStop('CLOUDFLARE_CREDENTIALS_MISSING', 'CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID are not set, so Cloudflare Web Analytics cannot be read.');

async function cf(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

const siteList = await cf(`https://api.cloudflare.com/client/v4/accounts/${account}/rum/site_info/list?per_page=100`);
if (!siteList.res.ok || !siteList.body.success) namedStop('CLOUDFLARE_REFUSED', `the Web Analytics site list answered ${siteList.res.status} (${(siteList.body.errors ?? []).map((e) => e.code).join(',') || 'no error code'}).`);
const siteTags = resolveSiteTags(siteList.body.result, hosts);
if (Object.keys(siteTags).length === 0) namedStop('CLOUDFLARE_NO_SITE_TAGS', `none of ${hosts.join(', ')} has a Web Analytics site in this account.`);

const QUERY = `query($account: String!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
  viewer { accounts(filter: { accountTag: $account }) {
    rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 5000) { count sum { visits } dimensions { siteTag refererHost date } }
  } }
}`;
const filter = { AND: [{ date_geq: window.since }, { date_leq: window.until }, { siteTag_in: Object.values(siteTags) }] };
const gql = await cf('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', body: JSON.stringify({ query: QUERY, variables: { account, filter } }) });
const groups = gql.body?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
if (!gql.res.ok || gql.body?.errors?.length || !Array.isArray(groups)) {
  namedStop('CLOUDFLARE_REFUSED', `the Web Analytics query answered ${gql.res.status} (${(gql.body?.errors ?? []).map((e) => e.message).join('; ').slice(0, 200) || 'no data'}).`);
}
const tally = tallyVisits(groups, siteTags, referrers);

const byHost = {};
for (const host of hosts) {
  let beaconIssue;
  try {
    const res = await fetch(`https://${host}/`, { headers: { 'User-Agent': UA, 'Cache-Control': 'no-cache' } });
    beaconIssue = res.ok ? beaconProblem(await res.text(), tokens[host]) : `the home page answered ${res.status}`;
  } catch (error) {
    beaconIssue = `the home page did not answer (${error?.message ?? error})`;
  }
  const entry = tally[host] ?? { site_tag: null, pageloads: 0, first_pageload_date: null, social_visits: 0, by_platform: { instagram: 0, tiktok: 0 } };
  byHost[host] = { ...entry, beacon: beaconIssue ?? 'ok' };
}
const visits = visitsDecision({ host: headline, beaconIssue: byHost[headline].beacon === 'ok' ? null : byHost[headline].beacon, tally: tally[headline], window });

// ── Posts: the brands Buffer ────────────────────────────────────────────────────
async function readPosts() {
  const key = process.env.BUFFER_BRANDS_ACCESS_TOKEN;
  if (!key) return { unread: 'BUFFER_BRANDS_ACCESS_TOKEN is not set (Missing key: the brands Buffer holding Dream Wedding\'s Instagram and TikTok)' };
  const call = async (query, variables = {}) => {
    const res = await fetch('https://api.buffer.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) throw new Error(`Buffer refused BUFFER_BRANDS_ACCESS_TOKEN (${res.status})`);
    if (!res.ok) throw new Error(`Buffer answered ${res.status}`);
    if (body.errors?.length) throw new Error(`Buffer answered: ${body.errors.map((e) => e.extensions?.code ?? e.message).join('; ').slice(0, 200)}`);
    return body.data;
  };
  try {
    const orgs = (await call('query { account { organizations { id } } }')).account?.organizations ?? [];
    let channels = [];
    const orgOf = {};
    for (const org of orgs) {
      const list = (await call('query($org: OrganizationId!) { channels(input: { organizationId: $org }) { id name displayName service } }', { org: org.id })).channels ?? [];
      for (const ch of brandChannels(list, handles)) { channels.push(ch); orgOf[ch.id] = org.id; }
    }
    if (channels.length === 0) return { unread: `the Buffer this key opens has no Instagram or TikTok channel named ${handles.join(' or ')}` };
    const posts = [];
    for (const orgId of new Set(Object.values(orgOf))) {
      const ids = channels.filter((ch) => orgOf[ch.id] === orgId).map((ch) => ch.id);
      let after = null;
      for (let page = 0; ; page += 1) {
        if (page === 20) return { unread: 'Buffer listed more than 2,000 sent posts; the count stopped rather than guess' };
        const data = await call(`query($org: OrganizationId!, $ids: [ChannelId!], $after: String) {
          posts(first: 100, after: $after, input: { organizationId: $org, filter: { channelIds: $ids, status: [sent] } }) {
            edges { node { id status sentAt channelId } } pageInfo { hasNextPage endCursor } } }`, { org: orgId, ids, after });
        posts.push(...(data.posts?.edges ?? []).map((e) => e.node));
        if (!data.posts?.pageInfo?.hasNextPage) break;
        after = data.posts.pageInfo.endCursor;
      }
    }
    const counted = countSentPosts(posts, channels, window);
    return { value: counted.total, by_platform: counted.byPlatform, channels: channels.map((ch) => ({ platform: String(ch.service).toLowerCase(), name: ch.name })) };
  } catch (error) {
    return { unread: String(error?.message ?? error) };
  }
}
const posts = await readPosts();

if (process.argv.includes('--prove')) {
  for (const [host, entry] of Object.entries(byHost)) console.log(`  ${host}: beacon ${entry.beacon}; ${entry.pageloads} page load(s) since ${window.since} (first ${entry.first_pageload_date ?? 'none'}); ${entry.social_visits} Instagram/TikTok visit(s)`);
  console.log(`  social_visits_28d: ${'value' in visits ? visits.value : `not read (${visits.unread})`}`);
  console.log(`  posts_published_28d: ${'value' in posts ? posts.value : `not read (${posts.unread})`}`);
  const broken = Object.entries(byHost).filter(([, entry]) => entry.beacon !== 'ok');
  if (broken.length) { console.error(`brand-social prove: FAIL - ${broken.length} host(s) cannot record a visit`); process.exit(1); }
  console.log(`brand-social prove: PASS - ${Object.keys(byHost).length} host(s) carry a beacon that records`);
  process.exit(0);
}

// ── Write ───────────────────────────────────────────────────────────────────────
const metrics = { updatedAt: now.toISOString(), headline_host: headline, window };
const unread = {};
if ('value' in posts) metrics.posts_published_28d = posts.value; else unread.posts_published_28d = posts.unread;
if ('value' in visits) metrics.social_visits_28d = visits.value; else unread.social_visits_28d = visits.unread;
metrics.by_platform = {
  posts: posts.by_platform ?? null,
  visits: 'value' in visits ? byHost[headline].by_platform : null
};
if (posts.channels) metrics.buffer_channels = posts.channels;
metrics.by_host = byHost;
metrics.unread = unread;
metrics.sources = {
  posts: 'api.buffer.com/graphql posts(status: sent), counted on sentAt, Dream Wedding Instagram and TikTok channels (handles from data/seo/entity.json)',
  visits: 'Cloudflare Web Analytics rumPageloadEventsAdaptiveGroups sum.visits by refererHost, matched on hostname (data/brand-social/social_referrers.json)'
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(metrics, null, 2)}\n`);

const show = (field) => (field in metrics ? String(metrics[field]) : `not read (${unread[field]})`);
const line = `OUTPUT brand-social: posts_published_28d=${show('posts_published_28d')}; social_visits_28d=${show('social_visits_28d')}; window ${window.since}..${window.until}; ${Object.keys(byHost).length} host(s) read`;
console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Brand social metrics\n\n${line}\n`);
