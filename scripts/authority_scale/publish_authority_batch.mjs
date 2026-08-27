#!/usr/bin/env node
// Publish the guides that are ready. Draft the ones that are not. Never invent one.
//
// History this replaces
// ---------------------
// Between 2026-07-30 and 2026-08-27 this script emitted ten fields per record when
// app/guides/[slug]/page.tsx needed fifteen, so it wrote 15 unrenderable entries a
// day for 28 days while the number of guides that actually served 200 stayed at 67.
// On 2026-08-27 it was changed to refuse rather than write junk, which was correct
// and also guaranteed the daily cron failed every single day: 5 candidates, 0
// written, exit 1.
//
// Both states came from the same mistake - treating a fan-out query string as if it
// were content. It is not. It is a question with no answer attached. The generator
// could compose the structure around an answer perfectly well; what it never had was
// the answer.
//
// What changed
// ------------
// data/authority/guide_composition_spec.json records what a guide in this library
// actually is, derived from the 67 that ship rather than invented: every structural
// field is a pure function of the cluster and the title, and exactly three sentences
// per guide carry judgement about the subject. derive_composition_spec.mjs proves it
// by recomposing all 67 from those three sentences, byte-identically.
//
// So the three sentences are the input, not the output. They live in
// data/authority/editorial_seeds.json, written by a person. This script composes the
// other twelve fields around them, checks the result against the predicate the router
// applies and against the library's own measured similarity ceiling, and publishes.
//
// The three states, and why only one of them is a failure
// -------------------------------------------------------
//   published   a seed was ready and passed every check                    exit 0
//   idle        no seed is ready, or the cadence budget is spent           exit 0
//   broken      a seed is malformed, or a composed record fails the        exit 1
//               router's own predicate - meaning this script has a bug
//
// "Nothing to publish" is a correct outcome and reports as one. A library with no
// unwritten material is a library that is caught up. The failure mode being guarded
// against is the opposite one: a scheduled job that treats an empty queue as pressure
// to produce something, which is exactly how 45 skeletons got written.
//
// Unseeded topics are not refused into a void either - they are composed as far as
// they can honestly be composed and written to artifacts/authority/authoring-queue.json
// with the three missing sentences named. That is a small, explicit human step, not a
// dead end.

import fs from 'node:fs';
import path from 'node:path';

import { findPlaceholders, isComplete, missingRequiredFields } from '../../lib/authority-complete.mjs';
import { aboutnessTokens, composeGuide } from '../../lib/authority-compose.mjs';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const exists = (p) => fs.existsSync(path.join(root, p));
const write = (p, v) => {
  const f = path.join(root, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
};

const doc = read('data/authority/content_registry.json');
const spec = read('data/authority/guide_composition_spec.json');
const seedDoc = read('data/authority/editorial_seeds.json');
const backlog = exists('data/authority/editorial_backlog.json') ? read('data/authority/editorial_backlog.json') : { gaps: [] };
const gov = read('data/authority_scale/velocity_governor.json');
const ownershipPath = 'data/seo/route_ownership.json';
const ownership = read(ownershipPath);
const cadence = exists('data/cadence/policy.json') ? read('data/cadence/policy.json') : {};

const today = new Date().toISOString().slice(0, 10);
const ledgerPath = 'data/authority_scale/publication_ledger.json';
const ledger = exists(ledgerPath) ? read(ledgerPath) : { schema_version: '1.1', published_ids: [], runs: [] };

const existingSlugs = new Set(doc.pages.map((p) => p.slug));
const existingTitles = new Set(doc.pages.map((p) => String(p.title || '').trim().toLowerCase()));
const existingKeys = new Set(doc.pages.map((p) => p.semantic_key));

// ---------------------------------------------------------------------------
// Budget. Two independent ceilings, and the run takes the smaller.
//
// The daily governor is a safety cap on a bad run. The weekly figure is the one
// that means something: data/cadence/policy.json carries it, and
// scripts/cadence/derive_capacity.mjs measures it from this repo's own history
// rather than asserting it. Neither is a target. Both are limits on how much of a
// ready queue may be released at once, and if the queue is empty they do nothing.
const dailyCeiling = Number(gov.current_default_new_page_ceiling_per_day || 15);

// Capacity is measured against the REGISTRY, not against this script's own ledger.
//
// The ledger only knows what this script published. Ten of the guides in the
// library this week were written by hand and never passed through it, so a
// ledger-based budget saw an empty week and would have released five more on top of
// them - the cadence policy silently applying to one author and not the other. It
// also had to reason about 45 entries it recorded as created and that were retired
// days later, which is bookkeeping about pages that no longer exist.
//
// updated_at on a live registry entry answers both cleanly: it counts every guide
// the library actually gained, whoever wrote it, and a retired guide is simply not
// there to count. A refresh consumes the same budget as a new page, which is
// correct - scripts/cadence/derive_capacity.mjs measures one throughput figure
// because authoring a guide and substantively refreshing one are the same unit of
// work.
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const livePages = doc.pages.filter(isComplete);
const changedToday = livePages.filter((p) => String(p.updated_at || '') === today).length;
const changedThisWeek = livePages.filter((p) => String(p.updated_at || '') >= weekAgo).length;
const weeklyCap = Number(cadence.new_pages_per_week ?? Infinity);
const dailyRemaining = Math.max(0, dailyCeiling - changedToday);
const weeklyRemaining = Number.isFinite(weeklyCap) ? Math.max(0, weeklyCap - changedThisWeek) : Infinity;
const budget = Math.min(dailyRemaining, weeklyRemaining);

// ---------------------------------------------------------------------------
// Similarity. The ceiling is the library's own measured maximum, not the build's
// tolerance. See the near_duplicate block in the composition spec: the hand-written
// guides top out around 0.73 while validate_authority_scale.mjs only breaks at 0.82.
// Holding new pages to 0.82 would let them be measurably more repetitive than
// anything a person wrote here and still pass. So they are held to 0.73.
const CEILING = Number(spec.near_duplicate?.observed_max_among_shipping_guides ?? 0.73);
const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const tokenSet = (p) => new Set(norm([p.answer, ...(p.steps || []), ...(p.mistakes || [])].join(' ')).split(' ').filter((x) => x.length > 3));
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = new Set([...a, ...b]).size; return u ? i / u : 0; };
const libraryTokenSets = doc.pages.filter(isComplete).map((p) => ({ slug: p.slug, set: tokenSet(p) }));

// ---------------------------------------------------------------------------
// related_slugs. Four siblings from the same cluster, ranked by what the guides are
// actually about - title, summary and recommendation together, not the title alone.
// Four is the shape every shipping guide has; a guide with two related links is a
// different object, so a cluster that cannot supply four holds the seed instead.
function pickRelated(seed, clusterPool) {
  const mine = aboutnessTokens(seed.title, seed.summary, seed.recommendation);
  return clusterPool
    .filter((p) => p.slug !== seed.slug)
    .map((p) => {
      const theirs = aboutnessTokens(p.title, p.summary, p.steps?.[1]);
      let overlap = 0;
      for (const w of mine) if (theirs.has(w)) overlap++;
      return { slug: p.slug, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || a.slug.localeCompare(b.slug))
    .slice(0, 4)
    .map((x) => x.slug);
}

// ---------------------------------------------------------------------------
const seeds = seedDoc.seeds || [];
const problems = [];
const skipped = [];
const held = [];
const admitted = [];

for (const seed of seeds) {
  const where = `editorial_seeds.json seed "${seed.slug || '(no slug)'}"`;

  // A malformed seed is a broken data file, not an empty queue. It fails the run.
  for (const field of ['slug', 'title', 'cluster', 'summary', 'recommendation', 'working_example']) {
    if (!seed[field] || typeof seed[field] !== 'string' || !seed[field].trim()) problems.push(`${where}: missing or empty "${field}"`);
  }
  if (seed.status && !['ready', 'draft', 'held'].includes(seed.status)) problems.push(`${where}: unknown status "${seed.status}"`);
  const cluster = spec.clusters?.[seed.cluster];
  if (!cluster) {
    problems.push(`${where}: cluster "${seed.cluster}" is not in guide_composition_spec.json. Known clusters: ${Object.keys(spec.clusters || {}).join(', ')}`);
    continue;
  }
  if (problems.length) continue;

  if (seed.status !== 'ready') { skipped.push({ slug: seed.slug, reason: 'NOT_READY', detail: `status is "${seed.status || 'unset'}"` }); continue; }
  if (existingSlugs.has(seed.slug)) { skipped.push({ slug: seed.slug, reason: 'ALREADY_PUBLISHED', detail: 'slug is already in the registry' }); continue; }
  if (existingTitles.has(String(seed.title).trim().toLowerCase())) { skipped.push({ slug: seed.slug, reason: 'DUPLICATE_TITLE', detail: 'a guide with this title already ships' }); continue; }

  const clusterPool = doc.pages.filter((p) => p.cluster === seed.cluster && isComplete(p));
  const record = composeGuide({ ...seed, updated_at: today }, cluster, pickRelated(seed, clusterPool));

  // The composed record is checked against the router's own predicate. A failure
  // here is a bug in lib/authority-compose.mjs, not a content gap, so it stops the
  // run rather than being quietly skipped.
  const missing = missingRequiredFields(record);
  if (missing.length) { problems.push(`${where}: composed record is missing ${missing.join(', ')} - lib/authority-compose.mjs is broken`); continue; }
  const placeholders = findPlaceholders(record);
  if (placeholders.length) { problems.push(`${where}: unexpanded placeholder at ${placeholders[0].path}: ${JSON.stringify(placeholders[0].value)}`); continue; }
  if (existingKeys.has(record.semantic_key)) { skipped.push({ slug: seed.slug, reason: 'DUPLICATE_SEMANTIC_KEY', detail: record.semantic_key }); continue; }
  if (record.related_slugs.length !== 4) {
    skipped.push({ slug: seed.slug, reason: 'TOO_FEW_SIBLINGS', detail: `cluster "${seed.cluster}" offers only ${record.related_slugs.length} other shipping guides; every guide in this library links to four` });
    continue;
  }

  // Held, not failed. A seed too close to an existing guide is a rewrite request
  // for its author, and the run carries on with the rest of the queue.
  const set = tokenSet(record);
  let worst = { slug: null, score: 0 };
  for (const other of libraryTokenSets) { const s = jaccard(set, other.set); if (s > worst.score) worst = { slug: other.slug, score: s }; }
  if (worst.score > CEILING) {
    held.push({ slug: seed.slug, reason: 'TOO_SIMILAR', detail: `scores ${worst.score.toFixed(3)} against ${worst.slug}; this library's hand-written maximum is ${CEILING}. Rewrite the summary, recommendation or working example so it says something the existing guide does not.` });
    continue;
  }

  admitted.push({ seed, record, set });
}

// A broken seed file is a failure. This is the "something is wrong" case.
if (problems.length) {
  console.error(`EDITORIAL SEEDS INVALID: ${problems.length} problem(s). Nothing was published.`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Route ownership.
//
// data/seo/route_ownership.json decides which host serves a path, and it feeds
// app/sitemap.xml, lib/site-config.ts, the sitemap builder, the distribution
// preparer and scripts/validate-seo-recovery.mjs. Nothing regenerates it - it was
// last written by hand - so a guide added to the registry alone is a guide the
// routing layer has never heard of, and validate-seo-recovery.mjs fails it with
// "missing guide ownership".
//
// That is the same producer/consumer split that caused the original 45-skeleton
// failure, one file over: the generator wrote to the store it knew about and not to
// the one the router reads. So publishing now registers the route in the same
// operation, deriving the host from the product exactly as lib/site-config.ts does.
const hostForProduct = Object.fromEntries(
  Object.entries(ownership.hosts).map(([host, cfg]) => [cfg.product_id, host]),
);
function registerRoute(record) {
  const p = `/guides/${record.slug}`;
  if (ownership.routes.some((r) => r.path === p)) return true;
  const host = hostForProduct[record.product_id];
  if (!host) return false;
  ownership.routes.push({ path: p, host, type: 'guide', indexable: true });
  return true;
}

// ---------------------------------------------------------------------------
// Release up to the budget. Everything beyond it stays ready for the next run -
// it is not discarded, and it is not a reason to fail.
const releasing = admitted.slice(0, Math.max(0, budget));
const waiting = admitted.slice(releasing.length);

for (const { record } of releasing) {
  if (!registerRoute(record)) {
    console.error(`ROUTE OWNERSHIP: no host in ${ownershipPath} owns product_id "${record.product_id}", so /guides/${record.slug} would have nowhere to be served from.`);
    process.exit(1);
  }
  doc.pages.push(record);
  existingSlugs.add(record.slug);
  existingTitles.add(String(record.title).trim().toLowerCase());
  existingKeys.add(record.semantic_key);
  libraryTokenSets.push({ slug: record.slug, set: tokenSet(record) });
}

// ---------------------------------------------------------------------------
// The authoring queue: backlog topics with no seed, composed as far as they
// honestly can be. Each entry names the cluster it now belongs to, the scaffold it
// would use, and the exact three sentences a person still has to write. This is
// what replaces "refuse and exit 1" - the work is visible and small.
const seededTopics = new Set(seeds.map((s) => s.source_topic).filter(Boolean));
const assignment = seedDoc.cluster_assignment?.map || {};
const queue = [];
for (const gap of backlog.gaps || []) {
  if (seededTopics.has(gap.topic)) continue;
  const assigned = assignment[gap.topic];
  if (!assigned) continue;
  const cluster = spec.clusters?.[assigned.cluster];
  if (!cluster) continue;
  if (queue.some((q) => q.topic === gap.topic && q.intent === gap.intent)) continue;
  queue.push({
    topic: gap.topic,
    intent: gap.intent,
    assigned_cluster: assigned.cluster,
    assignment_reason: assigned.why,
    product_id: cluster.product_id,
    hub_route: cluster.hub_route,
    scaffold_ready: true,
    needs_authoring: ['summary', 'recommendation', 'working_example'],
    instruction: `Add a seed to data/authority/editorial_seeds.json with cluster "${assigned.cluster}" and these three sentences. Everything else is composed by lib/authority-compose.mjs. See the authoring_rules in that file.`,
  });
}
write('artifacts/authority/authoring-queue.json', {
  schema_version: '1.0',
  run_at: new Date().toISOString(),
  note: 'Backlog topics that now have a home but not yet an author. Each needs three sentences; the other twelve fields are composed. This file is the replacement for a generator that refused and failed the build.',
  topics_awaiting_authoring: queue.length,
  seeds_ready_not_yet_released: waiting.length,
  queue,
});

// ---------------------------------------------------------------------------
if (releasing.length) {
  doc.generated_at = today;
  write('data/authority/content_registry.json', doc);
  write(ownershipPath, ownership);
  ledger.published_ids = [...new Set([...(ledger.published_ids || []), ...releasing.map((r) => r.record.semantic_key)])];
  ledger.runs.push({
    run_at: new Date().toISOString(),
    date: today,
    created: releasing.length,
    source: 'editorial_seeds',
    slugs: releasing.map((r) => r.record.slug),
    daily_ceiling: dailyCeiling,
    weekly_cap: Number.isFinite(weeklyCap) ? weeklyCap : null,
    budget_before_run: Number.isFinite(budget) ? budget : null,
    library_changed_this_week_before_run: changedThisWeek,
  });
  write(ledgerPath, ledger);
}

const summary = {
  status: releasing.length ? 'PUBLISHED' : 'IDLE',
  published: releasing.length,
  published_slugs: releasing.map((r) => r.record.slug),
  seeds_total: seeds.length,
  seeds_ready_waiting_for_budget: waiting.length,
  seeds_skipped: skipped.length,
  seeds_held_for_rewrite: held.length,
  topics_awaiting_authoring: queue.length,
  budget_this_run: Number.isFinite(budget) ? budget : null,
  daily_ceiling: dailyCeiling,
  weekly_cap: Number.isFinite(weeklyCap) ? weeklyCap : null,
  guides_added_or_refreshed_this_week: changedThisWeek,
  guides_added_or_refreshed_today: changedToday,
  similarity_ceiling: CEILING,
  registry_written: releasing.length > 0,
  total_guides: doc.pages.length,
};
console.log(JSON.stringify(summary, null, 2));

if (releasing.length) {
  console.log(`\nPublished ${releasing.length} guide(s): ${releasing.map((r) => r.record.slug).join(', ')}`);
} else {
  // The important line. This is a success, and it says why, so nobody reads a
  // green run with 0 pages as a silent failure.
  const why = admitted.length && budget <= 0
    ? `${admitted.length} seed(s) are ready but this week's cadence budget is spent: ${changedThisWeek} of ${weeklyCap} guides were added or refreshed in the last 7 days, by any author.`
    : seeds.length === 0
      ? 'data/authority/editorial_seeds.json holds no seeds.'
      : `No seed is ready to publish. ${skipped.length} skipped, ${held.length} held for rewrite, ${queue.length} topic(s) awaiting authoring.`;
  console.log(`\nNOTHING TO PUBLISH - this is a successful run. ${why}`);
  console.log('A library with nothing ready is caught up, not broken. Publishing requires authored material; this job will not manufacture it.');
}
for (const h of held) console.log(`  HELD    ${h.slug}: ${h.detail}`);
for (const s of skipped.filter((x) => x.reason !== 'ALREADY_PUBLISHED')) console.log(`  SKIP    ${s.slug}: ${s.reason} - ${s.detail}`);
if (queue.length) console.log(`  ${queue.length} topic(s) need three sentences each - see artifacts/authority/authoring-queue.json`);
