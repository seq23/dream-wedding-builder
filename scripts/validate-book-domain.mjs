#!/usr/bin/env node
/**
 * The domain printed inside the books must answer, and must never publish.
 *
 * Why this gate exists
 * --------------------
 * Five finished Kindle titles print `https://weddingpdfchecklist.com/amazon/<slug>`
 * on their last page. That host transposes the canonical one
 * (weddingchecklistpdf.com), and the link is baked into EPUBs that are already
 * on sale, so it cannot be corrected from this repo - the only remedy for a
 * broken link is re-uploading five books. It is the one hostname on this
 * property whose correctness is enforced by files outside the repo.
 *
 * scripts/validate-amazon-landing-paths.mjs already covers the five PATHS on the
 * canonical host. Nothing covered the HOST the books actually print, and a host
 * failure is total: every reader who follows a printed link gets a DNS error, a
 * certificate warning, or a 404, and none of the path-level assertions notice.
 *
 * The two halves of the assertion
 * -------------------------------
 * 1. It answers. Each of the five printed URLs is fetched over HTTPS on the book
 *    domain and must redirect permanently to the same path on the canonical host
 *    and end at a 200. TLS is not excused: fetch rejects an invalid certificate,
 *    and that rejection is a failure here, because a certificate warning ends a
 *    reader's journey exactly as dead as a 404 does.
 *
 * 2. It does not publish. The book domain must be declared as an alias, never as
 *    a canonical host, and the middleware must redirect it before any of the
 *    passthroughs. Serving the site on a second hostname would create a
 *    duplicate indexable copy competing with the canonical one - the failure
 *    mode that a second Worker custom domain invites if nobody is checking.
 *
 * The negative control
 * --------------------
 * A live probe that cannot tell "the alias is broken" from "this machine has no
 * network" is a gate that goes red on an aeroplane and gets switched off. So the
 * canonical host - known live, independently deployed - is probed first as a
 * control. If the control fails, the network is the problem and the live half is
 * reported UNPROVEN rather than passed or failed. If the control succeeds and
 * the alias does not, that is a real failure and it blocks.
 *
 * Rule 0: the five URLs are hardcoded here, examined is counted, and zero
 * examined exits non-zero. Reading the list from the file being validated would
 * let a deletion pass by removing the expectation along with the route.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// The exact host and paths printed in the five published EPUBs. Do not derive
// these from repo data; they are an external contract with files already on sale.
const BOOK_HOST = 'weddingpdfchecklist.com';
const CANONICAL_HOST = 'weddingchecklistpdf.com';
const BOOK_PATHS = [
  '/amazon/wedding-day-timeline',
  '/amazon/wedding-vendor-questions',
  '/amazon/wedding-seating-chart',
  '/amazon/wedding-budget-line-by-line',
  '/amazon/wedding-guest-list-problem',
];

const errors = [];
const notes = [];
const rows = [];
let examined = 0;
let probed = 0;

// ---------------------------------------------------------------------------
// Half 2 first, because it is offline and always runs: the declaration.
const ownership = read('data/seo/route_ownership.json');
const alias = (ownership.alias_hosts ?? {})[BOOK_HOST];
if (!alias) {
  errors.push(`${BOOK_HOST} is not declared in data/seo/route_ownership.json -> alias_hosts. Nothing in the app would know to redirect it.`);
} else {
  if (alias.redirects_to !== CANONICAL_HOST) errors.push(`${BOOK_HOST} redirects to ${alias.redirects_to}, but the site the books' readers must reach is ${CANONICAL_HOST}`);
  if (alias.indexable !== false) errors.push(`${BOOK_HOST} is not marked indexable:false. It must never be a second indexable copy of the site.`);
  if (alias.status !== 301) errors.push(`${BOOK_HOST} declares status ${alias.status}; the books are permanent, so the redirect must be 301`);
  const declared = new Set(alias.book_paths ?? []);
  for (const bookPath of BOOK_PATHS) {
    if (!declared.has(bookPath)) errors.push(`${bookPath} is printed in a published book but is not listed in alias_hosts["${BOOK_HOST}"].book_paths`);
  }
}
if (Object.prototype.hasOwnProperty.call(ownership.hosts ?? {}, BOOK_HOST)) {
  errors.push(`${BOOK_HOST} appears in route_ownership.json -> hosts. A canonical host renders pages; this one must only redirect, or the site gains a duplicate indexable copy.`);
}

// The middleware is the only thing that performs the redirect. Assert the wiring
// exists and runs before the passthrough list, because a passthrough would let
// robots.txt or a verification file be served on the alias - which is how a
// redirect-only host quietly becomes an indexable one.
const MIDDLEWARE = 'middleware.ts';
if (!fs.existsSync(path.join(ROOT, MIDDLEWARE))) {
  errors.push(`missing ${MIDDLEWARE} - nothing would redirect ${BOOK_HOST}`);
} else {
  const src = fs.readFileSync(path.join(ROOT, MIDDLEWARE), 'utf8');
  if (!/aliasRedirectTarget/.test(src)) {
    errors.push(`${MIDDLEWARE} does not call aliasRedirectTarget, so ${BOOK_HOST} would render the site instead of redirecting`);
  } else {
    const aliasAt = src.indexOf('aliasRedirectTarget(');
    const passthroughAt = src.indexOf('passthroughPrefixes.some(');
    if (passthroughAt >= 0 && aliasAt > passthroughAt) {
      errors.push(`${MIDDLEWARE} applies the alias redirect after the passthrough list, so some paths would still render on ${BOOK_HOST}`);
    }
    if (!/NextResponse\.redirect\(url, 301\)/.test(src)) errors.push(`${MIDDLEWARE} does not issue a 301 for the alias host`);
  }
}

// ---------------------------------------------------------------------------
// Half 1: the live probe, with its control.
async function probe(url) {
  const started = Date.now();
  try {
    const first = await fetch(url, { redirect: 'manual' });
    const location = first.headers.get('location');
    const final = await fetch(url, { redirect: 'follow' });
    const body = await final.text();
    return { ok: true, status: first.status, location, finalStatus: final.status, finalUrl: final.url, bytes: body.length, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, error: String(error?.cause?.message ?? error?.message ?? error) };
  }
}

const controlUrl = `https://${CANONICAL_HOST}${BOOK_PATHS[0]}`;
const control = await probe(controlUrl);
const networkAvailable = control.ok && control.finalStatus === 200;

if (!networkAvailable) {
  notes.push(`live probe UNPROVEN: the control ${controlUrl} did not answer 200 (${control.ok ? `status ${control.finalStatus}` : control.error}). This machine cannot reach the canonical host either, so the alias could not be tested. The declaration half above still ran.`);
} else {
  for (const bookPath of BOOK_PATHS) {
    const url = `https://${BOOK_HOST}${bookPath}`;
    const result = await probe(url);
    probed += 1;
    if (!result.ok) {
      // fetch rejects on DNS failure AND on an invalid certificate. Both end the
      // reader's journey, so both are failures with the reason printed.
      errors.push(`${url}: did not answer (${result.error}). A reader following the link printed in the book gets this instead of a page.`);
      rows.push({ url, status: null, final_url: null, error: result.error });
      continue;
    }
    const expectedFinal = `https://${CANONICAL_HOST}${bookPath}`;
    if (result.status !== 301) errors.push(`${url}: first response is ${result.status}, expected a 301. Anything else either publishes a duplicate copy of the page or loses the reader.`);
    if (result.location && result.location.replace(/\/$/, '') !== expectedFinal) errors.push(`${url}: redirects to ${result.location}, expected ${expectedFinal}. The per-slug path must survive the hop or the visit is attributed to the wrong page.`);
    if (result.finalStatus !== 200) errors.push(`${url}: ends at HTTP ${result.finalStatus} (${result.finalUrl}), not a working page`);
    if (result.finalUrl.replace(/\/$/, '') !== expectedFinal) errors.push(`${url}: resolves to ${result.finalUrl}, expected ${expectedFinal}`);
    rows.push({ url, status: result.status, location: result.location, final_status: result.finalStatus, final_url: result.finalUrl, bytes: result.bytes });
  }

  // The apex and www forms of the alias must both behave. A reader who types
  // www. in front of a printed URL must not hit a dead name.
  for (const host of [BOOK_HOST, `www.${BOOK_HOST}`]) {
    const url = `https://${host}/`;
    const result = await probe(url);
    if (!result.ok) errors.push(`${url}: did not answer (${result.error})`);
    else if (result.finalStatus !== 200 || !result.finalUrl.includes(CANONICAL_HOST)) errors.push(`${url}: ends at ${result.finalStatus} ${result.finalUrl}, expected a working page on ${CANONICAL_HOST}`);
    rows.push({ url, status: result.ok ? result.status : null, final_status: result.ok ? result.finalStatus : null, final_url: result.ok ? result.finalUrl : null, error: result.ok ? undefined : result.error });
  }
}

examined = BOOK_PATHS.length;

// Rule 0.
if (examined === 0) {
  console.error('BOOK DOMAIN: examined 0 book URLs. This gate cannot pass without checking something.');
  process.exit(2);
}

for (const row of rows) {
  console.log(`  ${row.url}  ->  ${row.error ? `ERROR ${row.error}` : `${row.status ?? '-'} then ${row.final_status} ${row.final_url}`}`);
}
for (const note of notes) console.log(`  NOTE   ${note}`);

if (errors.length) {
  console.error(`BOOK DOMAIN FAIL: ${errors.length} problem(s) across ${examined} printed URL(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`book domain: PASS (${examined} printed URLs declared, ${probed} fetched live over HTTPS on ${BOOK_HOST}, alias never indexable)`);
