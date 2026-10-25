#!/usr/bin/env node
/**
 * POST-DEPLOY LIVE CHECK: what the edge actually serves, after a deploy, on every
 * canonical host.
 *
 * Why it exists: the build gate and `validate:rendered-seo` both run against a
 * local `next start`. Everything between that build and a reader - Workers Builds,
 * the Worker's own middleware, Cloudflare's cache and redirect rules - can serve
 * something the build never contained, and nothing looked. The failure this is
 * written against is the generic one the Search Readiness checklist names: "a
 * Worker that 301'd robots.txt". That class of defect is invisible to every
 * validator in this repo because none of them fetch the live host.
 *
 * What it asserts, per canonical host read from data/seo/route_ownership.json:
 *   1. the crawl files answer 200 - robots.txt (naming a sitemap), sitemap.xml,
 *      llms.txt - and robots.txt is not a redirect
 *   2. favicon.ico, apple-touch-icon.png and site.webmanifest answer 200 and are
 *      not HTML (a SPA fallback answering 200 with a page is the usual shape)
 *   3. og.png answers 200 as an image
 *   4. the homepage carries the structured-data frame: WebSite, a complete
 *      Organization (name, url, logo, sameAs), WebPage and BreadcrumbList
 *   5. a made-up path answers 404 - not a redirect, and not a soft 200
 *   6. measured URLs do not redirect: a sample of this host's own sitemap URLs
 *      must answer 200 on the first hop
 *   7. the IndexNow key file (public/indexnow-key.txt) answers with the key
 *
 * Rule 0: it counts every assertion it made and fails on zero hosts or zero
 * assertions. A run that checked nothing has not passed.
 *
 * Local use: `node scripts/validate/live-check.mjs`, or
 * `LIVE_CHECK_HOSTS=weddingchecklistpdf.com node scripts/validate/live-check.mjs`
 * for one host. Read-only: every request is a GET or HEAD with no credentials.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const UA = 'Mozilla/5.0 (compatible; DreamWeddingBuilder-live-check/1.0; +https://weddingchecklistpdf.com/)';
const SITEMAP_SAMPLE = Number(process.env.LIVE_CHECK_SAMPLE ?? 8);

const ownership = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo/route_ownership.json'), 'utf8'));
const allHosts = Object.keys(ownership.hosts);
const hosts = (process.env.LIVE_CHECK_HOSTS ?? '').trim()
  ? process.env.LIVE_CHECK_HOSTS.split(/[\s,]+/).filter(Boolean)
  : allHosts;
const indexNowKey = fs.existsSync(path.join(ROOT, 'public/indexnow-key.txt'))
  ? fs.readFileSync(path.join(ROOT, 'public/indexnow-key.txt'), 'utf8').trim()
  : null;

const failures = [];
let assertions = 0;
const fail = (host, message) => { failures.push(`${host}: ${message}`); };
const assert = (host, condition, message) => { assertions += 1; if (!condition) fail(host, message); };

async function fetchOnce(url, { method = 'GET', redirect = 'manual' } = {}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { method, redirect, headers: { 'User-Agent': UA, 'Cache-Control': 'no-cache' } });
      const body = method === 'GET' ? await response.text() : '';
      return { status: response.status, location: response.headers.get('location'), type: response.headers.get('content-type') ?? '', body };
    } catch (error) {
      if (attempt === 3) return { status: null, error: String(error?.message ?? error), type: '', body: '' };
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return { status: null, error: 'unreachable', type: '', body: '' };
}

/** Every JSON-LD node on the page, flattened through @graph and arrays. */
function jsonLdNodes(html) {
  const nodes = [];
  const push = (value) => {
    if (Array.isArray(value)) { value.forEach(push); return; }
    if (!value || typeof value !== 'object') return;
    nodes.push(value);
    if (value['@graph']) push(value['@graph']);
  };
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { push(JSON.parse(match[1].replace(/\\u003c/g, '<'))); } catch { /* a malformed block is reported by the type assertions below */ }
  }
  return nodes;
}
const hasType = (nodes, type) => nodes.some((node) => [].concat(node['@type'] ?? []).includes(type));

async function checkHost(host) {
  const origin = `https://${host}`;

  // 1. Crawl files.
  const robots = await fetchOnce(`${origin}/robots.txt`);
  assert(host, robots.status === 200, `robots.txt answered ${robots.status ?? robots.error}${robots.location ? ` → ${robots.location}` : ''}`);
  assert(host, /sitemap:/i.test(robots.body), 'robots.txt names no sitemap');
  for (const file of ['/sitemap.xml', '/llms.txt']) {
    const response = await fetchOnce(`${origin}${file}`);
    assert(host, response.status === 200, `${file} answered ${response.status ?? response.error}${response.location ? ` → ${response.location}` : ''}`);
  }

  // 2 + 3. Icons, manifest and share card: 200, and not the HTML fallback.
  for (const [file, expected] of [['/favicon.ico', /icon|image/], ['/apple-touch-icon.png', /image\/png/], ['/site.webmanifest', /json|manifest/], ['/og.png', /image\/png/]]) {
    const response = await fetchOnce(`${origin}${file}`);
    assert(host, response.status === 200, `${file} answered ${response.status ?? response.error}`);
    assert(host, expected.test(response.type) && !/<html/i.test(response.body.slice(0, 200)), `${file} served ${response.type || 'no content-type'}${/<html/i.test(response.body.slice(0, 200)) ? ' (HTML)' : ''}`);
  }

  // 4. The homepage's structured-data frame, on whatever `/` resolves to.
  const home = await fetchOnce(origin, { redirect: 'follow' });
  assert(host, home.status === 200, `the homepage answered ${home.status ?? home.error}`);
  const nodes = jsonLdNodes(home.body);
  assert(host, nodes.length > 0, 'the homepage carries no JSON-LD');
  for (const type of ['WebSite', 'WebPage', 'BreadcrumbList']) {
    assert(host, hasType(nodes, type), `the homepage has no ${type}`);
  }
  const organization = nodes.find((node) => [].concat(node['@type'] ?? []).includes('Organization'));
  assert(host, Boolean(organization), 'the homepage has no Organization');
  if (organization) {
    const missing = ['name', 'url', 'logo', 'sameAs'].filter((key) => {
      const value = organization[key];
      return !value || (Array.isArray(value) && value.length === 0);
    });
    assert(host, missing.length === 0, `the homepage Organization lacks ${missing.join(', ')}`);
  }

  // 5. A made-up path is a real 404, not a redirect and not a soft 200.
  const notFound = await fetchOnce(`${origin}/live-check-${Date.now().toString(36)}-nope/`);
  assert(host, notFound.status === 404, `a made-up path answered ${notFound.status ?? notFound.error}${notFound.location ? ` → ${notFound.location}` : ''}, not 404`);

  // 6. Measured URLs answer on the first hop. A sitemap URL that 301s is a URL
  //    Search Console reports under one address and serves under another.
  const sitemapIndex = await fetchOnce(`${origin}/sitemap.xml`);
  const locs = [...sitemapIndex.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const childMaps = locs.filter((url) => url.endsWith('.xml'));
  let pageUrls = locs.filter((url) => !url.endsWith('.xml'));
  for (const child of childMaps) {
    const response = await fetchOnce(child);
    assert(host, response.status === 200, `sitemap ${child} answered ${response.status ?? response.error}`);
    pageUrls = pageUrls.concat([...response.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).filter((url) => !url.endsWith('.xml')));
  }
  assert(host, pageUrls.length > 0, 'the sitemap lists zero pages');
  const step = Math.max(1, Math.floor(pageUrls.length / SITEMAP_SAMPLE));
  const sample = pageUrls.filter((_, index) => index % step === 0).slice(0, SITEMAP_SAMPLE);
  for (const url of sample) {
    const response = await fetchOnce(url);
    assert(host, response.status === 200, `sitemap URL ${url} answered ${response.status ?? response.error}${response.location ? ` → ${response.location}` : ''}`);
  }

  // 7. The IndexNow key file.
  if (indexNowKey) {
    const response = await fetchOnce(`${origin}/${indexNowKey}.txt`);
    assert(host, response.status === 200 && response.body.trim() === indexNowKey, `the IndexNow key file answered ${response.status ?? response.error}`);
  } else {
    fail(host, 'public/indexnow-key.txt is missing, so the key file cannot be proved live');
  }
}

if (hosts.length === 0) {
  console.error('live check: route_ownership.json declares zero canonical hosts. A run with nothing to check has not passed.');
  process.exit(1);
}
const unknown = hosts.filter((host) => !allHosts.includes(host));
if (unknown.length) {
  console.error(`live check: LIVE_CHECK_HOSTS names ${unknown.join(', ')}, which route_ownership.json does not declare.`);
  process.exit(1);
}

for (const host of hosts) {
  process.stdout.write(`  checking https://${host} ...`);
  const before = failures.length;
  await checkHost(host);
  process.stdout.write(failures.length === before ? ' ok\n' : ` ${failures.length - before} problem(s)\n`);
}

if (assertions === 0) {
  console.error('live check: zero assertions ran. A run that checked nothing has not passed.');
  process.exit(1);
}
console.log(`live check: ${hosts.length} host(s), ${assertions} assertions`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`live check: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log('live check: PASS');
