#!/usr/bin/env node
/**
 * GUARD: what Bing Webmaster and the 2026-09-25 site audit read off the rendered
 * pages - titles, meta descriptions, duplicates, redirecting internal links, and
 * the http scheme - asserted on the real build rather than on the data files.
 *
 * Defects this was written against (Bing Webmaster + own crawl, 2026-09-25):
 *
 *   rules 113/117  weddingseatingchartmaker.com/products/seating-chart-maker listed
 *                  twice with a duplicate title and description. The two URLs were
 *                  http:// and https:// - plain http answered 200 on all four hosts.
 *   rule 118       weddingbudgetspreadsheet.com/ (a 308 to /wedding-budget-spreadsheet)
 *                  carried a 166-character description; six guides carried 81-96.
 *   audit          21-27 links per host to /free-wedding-planner?... that 308 to
 *                  weddingchecklistpdf.com, and 22 links on weddingchecklistpdf.com to
 *                  /products/*, /guides/* and hub routes that 308 to sibling hosts.
 *
 * What it asserts, per canonical host, by booting `next start` and fetching every
 * sitemap URL with that host's Host header:
 *
 *   1. every sitemap URL responds 200 with a <title> of 30-65 characters and a meta
 *      description of 120-160 (the Search Readiness bands, items b1/b2, tightened
 *      from 30-70/110-160 on 2026-10-25 after the audit found 14 titles and 13
 *      descriptions that the older bands passed)
 *   2. no two self-canonical sitemap URLs, across all four hosts, share a title or
 *      a description
 *   3. every href on those pages that points at a network host (the four canonical
 *      hosts, their www. forms, and the alias host) is fetched with that host's
 *      Host header, and must not answer 3XX - an emitter must link the final URL
 *   4. a request that Cloudflare marks as plain http (cf-visitor scheme http) is
 *      answered with a permanent redirect to the same https URL
 *   5. the structured-data frame, per page: an Organization with name, url, logo and
 *      sameAs; a WebPage; WebSite on the homepage and BreadcrumbList on inner pages;
 *      no FAQ question and no Offer price in JSON-LD that the visible page does not
 *      carry; and at least one priced Offer per host (Search Readiness c1/c2/c3/c5)
 *   6. session recording, in the SERVED HTML: a page carrying a conversion form
 *      (form[data-session-recording]) runs the Clarity loader as an ENABLED
 *      <script>, and a page carrying no such form never references it at all
 *      (Search Readiness e6/i8 and e9). Added 31 Oct 2026: ConversionAnalytics
 *      loaded the tag through next/script `afterInteractive`, which injects it
 *      from the client after hydration, so every form and buy page on all four
 *      hosts served a <link rel="preload"> and no script. A preload does not
 *      execute, so Clarity recorded nothing an HTML reader could see and nothing
 *      at all during the first seconds - which is exactly the window the item
 *      exists to measure. The unit test pins the component; this pins the build.
 *
 * Rule 0: it counts what it examined and fails on zero pages, zero network links,
 * zero conversion pages, or no build. A run that crawled nothing has not passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const ownership = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo/route_ownership.json'), 'utf8'));
const ENTITY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo/entity.json'), 'utf8'));
const siteHomes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo/site_homes.json'), 'utf8')).hosts;
// One list of hosts, read from the file that produces the sitemaps, so this gate
// cannot drift from what is actually published.
const HOSTS = Object.keys(ownership.hosts);
const ALIASES = Object.keys(ownership.alias_hosts ?? {});
const NETWORK = new Set([...HOSTS, ...HOSTS.map((h) => `www.${h}`), ...ALIASES, ...ALIASES.map((h) => `www.${h}`)]);

// The Search Readiness bands (items b1/b2), tightened from 30-70 / 110-160 on
// 2026-10-25. 65 is where a title stops being truncated in a desktop result; a
// description under 120 leaves the snippet half empty and lets the engine write the
// rest off the page. The audit found 14 titles and 13 descriptions outside these
// bands that the old bands passed.
const TITLE_MIN = 30;
const TITLE_MAX = 65;
const DESC_MIN = 120;
const DESC_MAX = 160;

const failures = [];
const fail = (message) => failures.push(message);
function die(message) {
  console.error(`  FAIL ${message}`);
  console.error('rendered seo contract: FAIL (1 problem(s))');
  process.exit(1);
}

if (HOSTS.length === 0) die('route_ownership.json declares zero canonical hosts');
if (!fs.existsSync(path.join(ROOT, '.next/BUILD_ID'))) {
  die('no .next build present - run `npm run build` before this gate. A run with nothing to crawl has not passed.');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

// Same process-group handling as validate_internal_link_graph.mjs: node <next-bin>
// in its own group, killed with SIGKILL, so the server cannot outlive the gate.
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const port = await freePort();
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });
let stopped = false;
const shutdown = () => {
  if (stopped) return;
  stopped = true;
  try { process.kill(-server.pid, 'SIGKILL'); } catch { /* group already gone */ }
  try { server.kill('SIGKILL'); } catch { /* already gone */ }
  server.unref();
};
process.on('exit', shutdown);
const WATCHDOG_MS = 8 * 60 * 1000;
setTimeout(() => {
  shutdown();
  console.error(`  FAIL crawl did not finish within ${WATCHDOG_MS / 1000}s. Server output:\n${serverLog.slice(-800)}`);
  console.error('rendered seo contract: FAIL (1 problem(s))');
  process.exit(1);
}, WATCHDOG_MS).unref();

const base = `http://127.0.0.1:${port}`;
const request = (host, pathname, extra = {}) => fetch(base + pathname, { headers: { Host: host, 'x-forwarded-host': host, ...extra }, redirect: 'manual' });

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await request(HOSTS[0], '/robots.txt')).status < 500) return true; } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}
if (!(await waitForServer())) { shutdown(); die(`next start never became ready on port ${port}. Server output:\n${serverLog.slice(-800)}`); }

const decode = (value) => value
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/\s+/g, ' ').trim();
const metaContent = (html, attr, name) => {
  const tag = html.match(new RegExp(`<meta[^>]*${attr}="${name}"[^>]*>`, 'i'))?.[0];
  return tag ? decode(tag.match(/content="([^"]*)"/i)?.[1] ?? '') : null;
};

// JSON-LD, flattened through @graph and arrays, and the visible text, so the
// structured-data rules are read off the same HTML the title rules are.
function jsonLdNodes(html) {
  const nodes = [];
  // Every nested object, not just @graph members: an Offer lives under
  // Product.offers and a Question under FAQPage.mainEntity. Walking only the top
  // level is how the first version of this check reported "no priced Offer" on
  // four pages that each carried one.
  const push = (value) => {
    if (Array.isArray(value)) { value.forEach(push); return; }
    if (!value || typeof value !== 'object') return;
    nodes.push(value);
    for (const nested of Object.values(value)) if (nested && typeof nested === 'object') push(nested);
  };
  for (const match of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { push(JSON.parse(match[1].replace(/\\u003c/g, '<'))); } catch { nodes.push({ __malformed: true }); }
  }
  return nodes;
}
const typesOf = (node) => [].concat(node['@type'] ?? []);
const nodesOfType = (nodes, re) => nodes.filter((node) => typesOf(node).some((type) => re.test(String(type))));
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

let pagesExamined = 0;
let schemaChecks = 0;
let conversionPages = 0;

/*
 * The Search Readiness auditor's `loadsClarity` rule, byte for byte in intent
 * (boss-os src/shared/boss/searchReadiness/audit.mjs): only an ENABLED <script>
 * element loads a recorder. A <link rel="preload"> warms the cache and runs
 * nothing, and markup inside a comment, <template> or <noscript> is inert.
 */
const CLARITY_SRC = /clarity\.ms|clarity\.js|\/clarity[-.]/i;
function loadsClarity(html) {
  const active = String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  return [...active.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].some((match) => {
    const attrs = match[1];
    const type = /\btype\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '';
    if (type && !/^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(type.trim())) return false;
    const src = /\bsrc\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '';
    return src ? CLARITY_SRC.test(src) : CLARITY_SRC.test(match[2]);
  });
}
const pricedOffers = new Map(); // host -> the page that carried one
const byTitle = new Map();
const byDesc = new Map();
const linkSources = new Map(); // "host path?query" -> Set(source)

try {
  for (const host of HOSTS) {
    const sitemap = await request(host, '/sitemap.xml');
    if (sitemap.status !== 200) { fail(`${host}: /sitemap.xml responded ${sitemap.status}`); continue; }
    const paths = [...(await sitemap.text()).matchAll(/<loc>https:\/\/[^/]+([^<]*)<\/loc>/g)].map((m) => m[1] || '/');
    if (paths.length === 0) { fail(`${host}: sitemap declares 0 URLs`); continue; }

    for (const pathname of paths) {
      const response = await request(host, pathname);
      pagesExamined += 1;
      const where = `${host}${pathname}`;
      if (response.status !== 200) { fail(`${where}: in the sitemap but responds ${response.status}`); continue; }
      const html = await response.text();

      const title = decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '');
      const desc = metaContent(html, 'name', 'description');
      const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i)?.[1] ?? null;
      if (title.length < TITLE_MIN || title.length > TITLE_MAX) fail(`${where}: title is ${title.length} chars (want ${TITLE_MIN}-${TITLE_MAX}): "${title}"`);
      // b10: shortening a title must never discard its owning site identity.
      const siteName = siteHomes[host].name;
      if (!title.toLowerCase().includes(siteName.toLowerCase())) fail(`${where}: title does not name ${siteName}: "${title}"`);
      for (const sibling of HOSTS.filter((candidate) => candidate !== host)) {
        if (title.toLowerCase().includes(siteHomes[sibling].name.toLowerCase())) fail(`${where}: title names sibling ${siteHomes[sibling].name}`);
      }
      if (metaContent(html, 'property', 'og:site_name') !== siteName) fail(`${where}: og:site_name does not name ${siteName}`);
      if (desc === null) fail(`${where}: no meta description`);
      else if (desc.length < DESC_MIN || desc.length > DESC_MAX) fail(`${where}: description is ${desc.length} chars (want ${DESC_MIN}-${DESC_MAX}): "${desc}"`);

      // Rule 6: session recording in the served HTML (e6/i8 and e9).
      const hasConversionForm = /<form\b[^>]*data-session-recording/.test(html);
      const runsClarity = loadsClarity(html);
      if (hasConversionForm) {
        conversionPages += 1;
        if (!runsClarity) {
          const preloadOnly = /<link\b[^>]*clarity-loader/i.test(html);
          fail(`${where}: a conversion form and no executable Clarity script${preloadOnly ? ' - only a <link rel="preload">, which does not execute' : ''}`);
        }
      } else if (runsClarity) {
        fail(`${where}: runs the Clarity loader with no conversion form on the page (e9)`);
      }

      // The structured-data frame, on every page in the sitemap. Search Readiness
      // items c1 (a complete Organization), c2 (WebPage everywhere, BreadcrumbList
      // on inner pages, WebSite on the homepage) and c5 (no FAQ question and no
      // Offer price in schema that the visible page does not carry). All four were
      // failing in October on pages no template owner had looked at in months,
      // because nothing in this repo read the rendered JSON-LD.
      const nodes = jsonLdNodes(html);
      const text = visibleText(html);
      schemaChecks += 1;
      if (nodes.some((node) => node.__malformed)) fail(`${where}: a JSON-LD block does not parse`);
      const org = nodesOfType(nodes, /^(Organization|Corporation|NewsMediaOrganization|ProfessionalService|LocalBusiness)$/)[0];
      if (!org) fail(`${where}: no Organization in JSON-LD`);
      else {
        const missing = ['name', 'url', 'logo', 'sameAs'].filter((key) => !org[key] || (Array.isArray(org[key]) && org[key].length === 0));
        if (missing.length) fail(`${where}: the first Organization lacks ${missing.join(', ')}`);
      }
      // The entity graph (data/seo/entity.json, authority audit 30 Oct 2026): the brand
      // and this host's own site Organization are both on the page, each with exactly
      // the sameAs entity.json gives it - so a site can never again ship a profile it
      // borrowed from a sibling, and the built page cannot drift from the record.
      for (const [label, record] of [['brand', ENTITY.brand], [`site ${host}`, ENTITY.sites[host]]]) {
        const node = record && nodes.find((item) => item['@id'] === record['@id'] && [].concat(item['@type'] ?? []).includes('Organization') && item.name);
        if (!node) { fail(`${where}: no ${label} Organization ${record?.['@id']} in JSON-LD`); continue; }
        const got = JSON.stringify([].concat(node.sameAs ?? []));
        if (got !== JSON.stringify(record.sameAs)) fail(`${where}: ${label} Organization sameAs is ${got}, entity.json says ${JSON.stringify(record.sameAs)}`);
        for (const key of ['name', 'logo', 'description']) if (node[key] !== record[key]) fail(`${where}: ${label} Organization ${key} differs from entity.json`);
      }
      if (nodesOfType(nodes, /WebPage$|^(AboutPage|ContactPage|FAQPage|CollectionPage|ItemPage|ProfilePage|QAPage)$/).length === 0) fail(`${where}: no WebPage in JSON-LD`);
      const isHome = pathname === '/' || pathname === ownership.hosts[host]?.root_target;
      if (isHome && nodesOfType(nodes, /^WebSite$/).length === 0) fail(`${where}: the homepage has no WebSite`);
      if (!isHome && nodesOfType(nodes, /^BreadcrumbList$/).length === 0) fail(`${where}: an inner page with no BreadcrumbList`);
      // Static bundle pages bypass the [slug] product template. Require their
      // Product and its own priced Offer too, rather than passing because a
      // different page on the host has one (Ahrefs, 27 Oct 2026).
      if (pathname.startsWith('/products/')) {
        const product = nodesOfType(nodes, /^Product$/)[0];
        if (!product) fail(`${where}: a product page has no Product schema`);
        else if (![product.offers].flat().some((offer) => Number(offer?.price) > 0 && offer?.priceCurrency === 'USD' && offer?.url === `https://${host}${pathname}`)) {
          fail(`${where}: Product has no priced USD Offer for its canonical URL`);
        }
      }
      for (const question of nodesOfType(nodes, /^Question$/)) {
        const name = String(question.name ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (name && !text.includes(name.slice(0, 60))) fail(`${where}: FAQ question is marked up but not on the page: "${name.slice(0, 60)}"`);
      }
      for (const offer of nodesOfType(nodes, /^Offer$/)) {
        if (offer.price === undefined || Number(offer.price) === 0) continue;
        const price = String(offer.price).replace(/\.0+$/, '');
        if (!text.includes(price)) fail(`${where}: schema offers ${price} and the page does not print it`);
        else if (!pricedOffers.has(host)) pricedOffers.set(host, where);
      }

      const selfCanonical = canonical === `https://${host}${pathname}`;
      if (selfCanonical) {
        if (!byTitle.has(title)) byTitle.set(title, []);
        byTitle.get(title).push(where);
        if (desc) { if (!byDesc.has(desc)) byDesc.set(desc, []); byDesc.get(desc).push(where); }
      }

      for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
        let url;
        try { url = new URL(decode(match[1]), `https://${host}${pathname}`); } catch { continue; }
        if (!/^https?:$/.test(url.protocol) || !NETWORK.has(url.hostname)) continue;
        const key = `${url.protocol}//${url.hostname}${url.pathname}${url.search}`;
        if (!linkSources.has(key)) linkSources.set(key, new Set());
        linkSources.get(key).add(where);
      }
    }
  }

  for (const [title, where] of byTitle) if (where.length > 1) fail(`duplicate title on ${where.length} self-canonical pages "${title}": ${where.join(', ')}`);
  for (const [desc, where] of byDesc) if (where.length > 1) fail(`duplicate description on ${where.length} self-canonical pages "${desc.slice(0, 70)}...": ${where.join(', ')}`);

  // Every network link, fetched once. A 3XX here is a hop every crawler pays and
  // Bing reports; the emitter must link the final URL.
  let redirecting = 0;
  for (const [key, sources] of linkSources) {
    const url = new URL(key);
    const extra = url.protocol === 'http:' ? { 'cf-visitor': '{"scheme":"http"}' } : {};
    const response = await request(url.hostname, `${url.pathname}${url.search}`, extra);
    if (response.status >= 300 && response.status < 400) {
      redirecting += 1;
      const list = [...sources];
      fail(`internal link ${key} answers ${response.status} -> ${response.headers.get('location')} (linked from ${list.length}: ${list.slice(0, 3).join(', ')}${list.length > 3 ? ', ...' : ''})`);
    }
  }
  console.log(`  network links: unique=${linkSources.size} redirecting=${redirecting}`);

  // The scheme. One sitemap URL per host, marked as plain http by Cloudflare.
  for (const host of HOSTS) {
    const target = host === ownership.parent_host ? '/guides' : ownership.hosts[host].root_target;
    const response = await request(host, target, { 'cf-visitor': '{"scheme":"http"}', 'cf-ray': 'validator' });
    const location = response.headers.get('location');
    if (![301, 308].includes(response.status) || location !== `https://${host}${target}`) {
      fail(`http://${host}${target}: expected a permanent redirect to https://${host}${target}, got ${response.status}${location ? ` -> ${location}` : ''}`);
    }
  }
} finally {
  shutdown();
}

if (pagesExamined === 0) fail('examined 0 pages across all hosts - a run that crawled nothing has not passed');
if (schemaChecks === 0) fail('read JSON-LD on 0 pages - the structured-data rules examined nothing');
// A build that renders no conversion form has not exercised rule 6 - and could not,
// because a checkout form is how these sites earn. Zero is a broken crawl, not a pass.
if (conversionPages === 0) fail('found 0 pages with a conversion form - the session-recording rule examined nothing');
// Search Readiness item c3: a brand site needs one priced Offer a result can carry.
// Each host sells one product and prints its price on its own homepage.
for (const host of HOSTS) if (!pricedOffers.has(host)) fail(`${host}: no page carries a priced Offer whose price is on the page`);
if (linkSources.size === 0) fail('found 0 network links on any page - the link check examined nothing');

console.log(`rendered seo contract: hosts=${HOSTS.length} pages=${pagesExamined} titles=${byTitle.size} descriptions=${byDesc.size} network_links=${linkSources.size} schema_pages=${schemaChecks} priced_offers=${pricedOffers.size} conversion_pages=${conversionPages}`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`rendered seo contract: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log('rendered seo contract: PASS');
process.exit(0);
