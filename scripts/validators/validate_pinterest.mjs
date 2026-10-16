/**
 * Pinterest launch gate for weddingchecklistpdf.com, against the BUILT site.
 *
 * Boots `next start` on the .next build and asserts, as Pinterest will see it:
 *   - the homepage's rendered <head> carries the p:domain_verify meta tag verbatim;
 *   - /pinfeed.xml (and /pinfeed) answers 200 application/rss+xml, parses as RSS 2.0
 *     (Python's XML parser), and holds at least 5 items;
 *   - every item link is a page on weddingchecklistpdf.com carrying the pinfeed UTM
 *     params and answers 200 (no redirect), and every enclosure image answers 200
 *     with the declared type.
 * No build is a hard failure, never a skip. CI runs it via validate:registry after build.
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';

const ROOT = process.cwd();
const HOST = 'weddingchecklistpdf.com';
const META = '<meta name="p:domain_verify" content="0fcfdee391238788157a7120c048a945"/>';
const failures = [];
const fail = (m) => failures.push(m);
const die = (m) => { console.error(`  FAIL ${m}`); console.error('pinterest: FAIL'); process.exit(1); };

if (!fs.existsSync(path.join(ROOT, '.next/BUILD_ID'))) die('no .next build present - run `npm run build` before this gate.');

const port = await new Promise((resolve, reject) => { const s = net.createServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => { const { port: p } = s.address(); s.close(() => resolve(p)); }); });
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let log = '';
server.stdout.on('data', (c) => { log += c; });
server.stderr.on('data', (c) => { log += c; });
const shutdown = () => { try { process.kill(-server.pid, 'SIGKILL'); } catch { /* gone */ } try { server.kill('SIGKILL'); } catch { /* gone */ } };
process.on('exit', shutdown);
setTimeout(() => { shutdown(); console.error(`  FAIL did not finish within 180s\n${log.slice(-800)}`); process.exit(1); }, 180_000).unref();

const base = `http://127.0.0.1:${port}`;
const get = (p) => fetch(base + p, { headers: { Host: HOST, 'x-forwarded-host': HOST }, redirect: 'manual' });
let ready = false;
for (let i = 0; i < 120 && !ready; i += 1) {
  try { ready = (await get('/')).status < 500; } catch { await new Promise((r) => setTimeout(r, 500)); }
}
if (!ready) { shutdown(); die(`next start never became ready\n${log.slice(-800)}`); }

const home = await get('/');
const html = await home.text();
const head = html.split('</head>')[0];
if (home.status !== 200) fail(`/ responds ${home.status}`);
if (!head.includes(META)) fail(`homepage <head> does not contain ${META}`);

let items = [];
for (const feedPath of ['/pinfeed.xml', '/pinfeed']) {
  const res = await get(feedPath);
  if (res.status !== 200) { fail(`${feedPath} responds ${res.status}`); continue; }
  if (!/^application\/rss\+xml/.test(res.headers.get('content-type') ?? '')) fail(`${feedPath} content-type ${res.headers.get('content-type')}`);
  try {
    items = JSON.parse(execFileSync('python3', ['-I', 'scripts/pinterest/parse_feed.py'], { input: await res.text() }).toString()).items;
  } catch (error) { fail(`${feedPath} does not parse as RSS 2.0: ${error.message.split('\n')[0]}`); }
}
if (items.length < 5) fail(`feed holds ${items.length} items, expected at least 5`);

for (const item of items) {
  const link = new URL(item.link);
  if (link.host !== HOST) fail(`${item.link}: not on ${HOST}`);
  if (link.searchParams.get('utm_source') !== 'pinterest' || link.searchParams.get('utm_medium') !== 'organic' || link.searchParams.get('utm_campaign') !== 'pinfeed') fail(`${item.link}: missing pinfeed utm params`);
  const page = await get(link.pathname + link.search);
  if (page.status !== 200) fail(`${link.pathname}: responds ${page.status}`);
  for (const url of new Set([item.enclosure?.url, item.media?.url])) {
    if (!url) { fail(`${item.title}: no image`); continue; }
    const img = new URL(url);
    if (img.host !== HOST) fail(`${url}: not on ${HOST}`);
    const res = await get(img.pathname);
    if (res.status !== 200) fail(`${img.pathname}: responds ${res.status}`);
    else if (res.headers.get('content-type') !== item.enclosure.type) fail(`${img.pathname}: content-type ${res.headers.get('content-type')}, feed says ${item.enclosure.type}`);
  }
}

shutdown();
if (failures.length) { for (const f of failures) console.error(`  FAIL ${f}`); console.error(`pinterest: FAIL (${failures.length} problem(s))`); process.exit(1); }
console.log(`pinterest: PASS (meta tag in <head>, feed ${items.length} items, ${items.length} pages + images 200)`);
process.exit(0);
