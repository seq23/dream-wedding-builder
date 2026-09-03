#!/usr/bin/env node
/**
 * GUARD: no page in a published sitemap may have zero inbound internal links.
 *
 * Why this is a crawl and not a static analysis.
 *
 * The defect it exists to catch is a page that is published to crawlers and
 * linked by nothing. That is a property of the rendered HTML, not of any data
 * file, and every cheaper way of checking it asserts the model instead of the
 * behaviour. data/seo/route_ownership.json produces the sitemap; the templates
 * produce the links; a validator that reads only the first can pass while the
 * second emits nothing. So this boots the real build, asks each host for its
 * real sitemap, fetches every URL in it with that host's Host header, and reads
 * the anchors out of the HTML the server actually returned.
 *
 * What it asserts, per canonical host:
 *
 *   1. the sitemap is non-empty
 *   2. every URL in it responds 200 (a 3XX or 404 in your own sitemap is a
 *      separate defect and is reported by path)
 *   3. every URL in it is the target of at least one same-host anchor on some
 *      other URL in it
 *   4. the two components that produce those links still exist: the consumer of
 *      route_ownership.json, and the footer surface that renders it. Deleting
 *      either is how the orphans came back last time.
 *
 * Reproduced defect this was written against - Ahrefs crawl, 2026-09-03:
 *   weddingchecklistpdf.com     5 orphans - the five /amazon/<slug> book pages
 *   weddingtimelinetemplate.com 1 orphan  - /what-to-do-6-months-before-the-wedding
 * Running this script at 5fe322f reproduces exactly those six and nothing else.
 *
 * Rule 0: it counts what it examined and fails on zero. No build, no sitemap, or
 * no URLs is a hard failure, never an empty pass - a run that checked nothing has
 * not proved anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const HOSTS = [
  'weddingchecklistpdf.com',
  'weddingbudgetspreadsheet.com',
  'weddingtimelinetemplate.com',
  'weddingseatingchartmaker.com'
];

const failures = [];
const fail = (message) => failures.push(message);

function die(message) {
  console.error(`  FAIL ${message}`);
  console.error('internal link graph: FAIL (1 problem(s))');
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, '.next/BUILD_ID'))) {
  // Not "unproven". This gate has one job and cannot do it without a build, and a
  // green run that skipped the only check it owns is exactly the failure mode the
  // repo keeps rediscovering. Run `npm run build` first; CI runs this after build.
  die('no .next build present - run `npm run build` before this gate. A run with nothing to crawl has not passed.');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

const port = await freePort();
const server = spawn('npx', ['next', 'start', '-p', String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });
const shutdown = () => { try { server.kill('SIGTERM'); } catch { /* already gone */ } };
process.on('exit', shutdown);

const base = `http://127.0.0.1:${port}`;
const request = (host, pathname) => fetch(base + pathname, { headers: { Host: host, 'x-forwarded-host': host }, redirect: 'manual' });

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await request(HOSTS[0], '/');
      if (response.status < 500) return true;
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

if (!(await waitForServer())) {
  shutdown();
  die(`next start never became ready on port ${port}. Server output:\n${serverLog.slice(-800)}`);
}

let examined = 0;
const orphansByHost = {};

try {
  for (const host of HOSTS) {
    const sitemapResponse = await request(host, '/sitemap.xml');
    if (sitemapResponse.status !== 200) { fail(`${host}: /sitemap.xml responded ${sitemapResponse.status}`); continue; }
    const xml = await sitemapResponse.text();
    const paths = [...xml.matchAll(/<loc>https:\/\/[^/]+([^<]*)<\/loc>/g)].map((match) => match[1] || '/');
    if (paths.length === 0) { fail(`${host}: sitemap declares 0 URLs - examined nothing, so nothing is proved`); continue; }

    const inbound = new Map(paths.map((item) => [item, new Set()]));
    for (const pathname of paths) {
      const response = await request(host, pathname);
      examined += 1;
      if (response.status !== 200) {
        fail(`${host}${pathname}: in the sitemap but responds ${response.status}${response.headers.get('location') ? ` -> ${response.headers.get('location')}` : ''}`);
        continue;
      }
      const html = await response.text();
      for (const match of html.matchAll(/href="([^"]+)"/g)) {
        let url;
        try { url = new URL(match[1], `https://${host}/`); } catch { continue; }
        if (url.hostname !== host) continue; // a cross-host link is external to this domain's crawl
        const target = url.pathname.replace(/\/$/, '') || '/';
        for (const candidate of [target, `${target}/`]) {
          if (inbound.has(candidate) && candidate !== pathname) inbound.get(candidate).add(pathname);
        }
      }
    }

    const orphans = paths.filter((item) => inbound.get(item).size === 0);
    orphansByHost[host] = orphans;
    for (const orphan of orphans) fail(`${host}${orphan}: in the sitemap and has no incoming internal link from any other page on this host`);
    console.log(`  ${host}: urls=${paths.length} orphans=${orphans.length}`);
  }
} finally {
  shutdown();
}

// Anti-regression on the producer itself. The crawl above already fails if the
// links disappear, but these two name the file to fix rather than leaving the
// next reader with six orphan URLs and no cause.
const directoryModule = fs.readFileSync(path.join(ROOT, 'lib/site-directory.ts'), 'utf8');
if (!directoryModule.includes('export function siteDirectory')) fail('lib/site-directory.ts: siteDirectory() is gone, so route_ownership.json has no consumer producing links again');
const appShell = fs.readFileSync(path.join(ROOT, 'components/AppShell.tsx'), 'utf8');
if (!appShell.includes('data-testid="site-directory"')) fail('components/AppShell.tsx: the footer site directory is gone - the only surface that links hub, landing and book-companion routes on their own host');

if (examined === 0) fail('examined 0 pages across all hosts - a run that crawled nothing has not passed');

console.log(`internal link graph: hosts=${HOSTS.length} pages=${examined} orphans=${Object.values(orphansByHost).flat().length}`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`internal link graph: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log(`internal link graph: PASS (all ${examined} sitemap URLs on ${HOSTS.length} hosts have at least one inbound internal link)`);
