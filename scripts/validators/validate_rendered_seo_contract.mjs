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
 *   1. every sitemap URL responds 200 with a <title> of 30-70 characters (Bing Site
 *      Scan flags "title too long" above 70) and a meta description of 110-160
 *   2. no two self-canonical sitemap URLs, across all four hosts, share a title or
 *      a description
 *   3. every href on those pages that points at a network host (the four canonical
 *      hosts, their www. forms, and the alias host) is fetched with that host's
 *      Host header, and must not answer 3XX - an emitter must link the final URL
 *   4. a request that Cloudflare marks as plain http (cf-visitor scheme http) is
 *      answered with a permanent redirect to the same https URL
 *
 * Rule 0: it counts what it examined and fails on zero pages, zero network links,
 * or no build. A run that crawled nothing has not passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const ownership = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo/route_ownership.json'), 'utf8'));
// One list of hosts, read from the file that produces the sitemaps, so this gate
// cannot drift from what is actually published.
const HOSTS = Object.keys(ownership.hosts);
const ALIASES = Object.keys(ownership.alias_hosts ?? {});
const NETWORK = new Set([...HOSTS, ...HOSTS.map((h) => `www.${h}`), ...ALIASES, ...ALIASES.map((h) => `www.${h}`)]);

const TITLE_MIN = 30;
const TITLE_MAX = 70;
const DESC_MIN = 110;
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

let pagesExamined = 0;
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
      if (desc === null) fail(`${where}: no meta description`);
      else if (desc.length < DESC_MIN || desc.length > DESC_MAX) fail(`${where}: description is ${desc.length} chars (want ${DESC_MIN}-${DESC_MAX}): "${desc}"`);

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
if (linkSources.size === 0) fail('found 0 network links on any page - the link check examined nothing');

console.log(`rendered seo contract: hosts=${HOSTS.length} pages=${pagesExamined} titles=${byTitle.size} descriptions=${byDesc.size} network_links=${linkSources.size}`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`rendered seo contract: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log('rendered seo contract: PASS');
process.exit(0);
