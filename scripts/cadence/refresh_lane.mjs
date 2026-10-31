#!/usr/bin/env node
// The refresh lane: the automated step that pays down refresh debt.
//
// Why it exists
// -------------
// PR #53 (c27e4ac) turned refresh debt into a named HOLD: cadence_gate.js holds new
// publishing until the oldest pages past the 91-day window are refreshed, and
// writes those pages to reports/cadence/refresh-queue.json. Nothing read that
// queue. A hold with no lane that can clear it is a stop that waits on a person
// forever - the "exists but nothing invokes it" defect. This lane reads the same
// debt (scripts/cadence/refresh_debt.cjs, the one implementation the gate and the
// publisher already share) and refreshes the oldest queued guides each scheduled run.
//
// What a refresh is here, and what it is not
// ------------------------------------------
// A guide's lastmod is not a field anyone sets. scripts/seo/build_lastmod_ledger.mjs
// derives it from git history: the date of the commit that introduced the guide's
// current content fingerprint (the registry entry minus updated_at). So the ONLY
// way this lane can move a page's lastmod is to change what the page says. A date
// bump is not merely forbidden; it is impossible by construction. updated_at is
// written only on a page whose content changed.
//
// The content that carries judgement is three sentences per guide (summary,
// recommendation, working_example - see data/authority/editorial_seeds.json and
// guide_composition_spec.json). The lane:
//   1. re-checks the page's links against the library: every related_slug must be
//      a renderable guide and the hub route must match the cluster's; broken ones
//      are re-picked by the publisher's own relatedness rule;
//   2. re-composes the scaffold around the sentences from the CURRENT composition
//      spec, so a scaffold that moved since the page was written is brought in line;
//   3. asks a $0 model (scripts/llm/free_router.mjs - the only model door in this
//      repo) to rewrite the three sentences against the page's measured target
//      query, under the authoring rules every seed is held to;
//   4. accepts the rewrite only if it passes deterministic fact guards: no figure
//      that is not already on the page, no new proper noun (people, brands,
//      reviewers, agencies), no citation, statistic or study language, no URL,
//      the hedged "Example:" form kept, a real change rather than a reword of a
//      few words, and the library's own near-duplicate ceiling held.
// A page that cannot be refreshed honestly is recorded with the reason in
// data/cadence/refresh_lane_ledger.json (cadence_gate.js folds that into the queue)
// and is retried after a cool-off; the lane moves on to the next page.
//
// Outcomes - never a silent zero
//   REFRESHED            n pages changed                                   exit 0
//   QUEUE_EMPTY          no page is past the window (named)                exit 0
//   MODEL_UNAVAILABLE    the router returned a named stop (named)          exit 0
//   NONE_PASSED_GUARDS   every candidate was rejected, reasons recorded    exit 0
//   BROKEN               registry/spec unreadable, or a paid cost reported exit 1
// `--name-outcome` prints the receipt and exits 1 when the lane has STALLED: the
// queue was non-empty and nothing was refreshed on each of the last 3 run days.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isComplete, findPlaceholders } from '../../lib/authority-complete.mjs';
import { aboutnessTokens, composeGuide, extractSeed } from '../../lib/authority-compose.mjs';
import { routeChat, PaidCostError } from '../llm/free_router.mjs';
import refreshDebtModule from './refresh_debt.cjs';

const { sitemapUrls, refreshDebt, cadenceToday } = refreshDebtModule;

export const REGISTRY = 'data/authority/content_registry.json';
export const SPEC = 'data/authority/guide_composition_spec.json';
export const POLICY = 'data/cadence/policy.json';
export const LEDGER = 'data/cadence/refresh_lane_ledger.json';
export const SCOPE = 'data/release/active_mutation_scope.json';
export const OUTCOME = 'artifacts/cadence/refresh-lane-outcome.json';
export const TARGETS = 'data/search_intelligence/targets.json';

// Pacing. The queue should drain in about two weeks, never faster than a ceiling
// that keeps the lane's own commits from looking like a bulk rewrite (the gate's
// uniform_lastmod warning fires when the whole library shares one recent date).
export const DRAIN_DAYS = 14;
export const MAX_PER_RUN = 4;
export const COOL_OFF_DAYS = 7;
export const STALL_RUN_DAYS = 3;
// Measured on run 41236802294: a free-model reply takes 30-55s, so 4 minutes bought
// three attempts and one refresh. Seven minutes buys the per-run target.
const DEFAULT_BUDGET_MS = 420000;

/** Pages to refresh this run: enough to clear the needed count in DRAIN_DAYS. */
export function perRun(refreshesNeeded, queued) {
  if (!queued) return 0;
  const want = Math.ceil(Math.max(refreshesNeeded, 1) / DRAIN_DAYS);
  return Math.min(MAX_PER_RUN, queued, Math.max(1, want));
}

// ---------------------------------------------------------------------------
// Fact guards. Pure, so the unit test pins them.

const SENT_FIELDS = ['summary', 'recommendation', 'working_example'];
const numbersIn = (s) => new Set((String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, '').replace(/\.0+$/, '')));
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9$%]+/g, ' ').trim().split(/\s+/).filter(Boolean);
// Acronyms and capitalised words that are part of the subject, not claims.
const CAPS_ALLOW = new Set(['RSVP', 'RSVPs', 'FAQ', 'PDF', 'A', 'I', 'Example', 'If', 'When', 'Before', 'After']);
const CLAIM_LANGUAGE = /\b(according to|studies|study|survey|surveys|research (shows|finds|suggests)|statistic|statistics|on average|the average|national average|percent of|most couples|experts?|reviewed by|fact-checked|certified|award|law requires|legally required|IRS|in \d{4})\b/i;

function capitalisedNonInitial(s) {
  const out = [];
  for (const sentence of String(s).split(/(?<=[.!?:;])\s+/)) {
    const toks = sentence.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    toks.slice(1).forEach((t) => { if (/^[A-Z]/.test(t)) out.push(t.replace(/['’]s$/, '')); });
  }
  return out;
}

/**
 * Every reason a proposed rewrite is not an honest refresh of `old`.
 * @param old   { title, summary, recommendation, working_example }
 * @param next  same fields, proposed
 * @returns string[] - empty means accepted
 */
export function factGuard(old, next) {
  const problems = [];
  const before = SENT_FIELDS.map((f) => old[f]).join(' ');
  const source = `${old.title} ${before}`;
  for (const f of SENT_FIELDS) {
    const v = next?.[f];
    if (typeof v !== 'string' || !v.trim()) { problems.push(`${f}: missing`); continue; }
    if (/\n/.test(v)) problems.push(`${f}: contains a line break`);
    if (/https?:|www\.|@|\[|\]|[*#`]/.test(v)) problems.push(`${f}: contains a link, handle or markup`);
    if (findPlaceholders(v).length) problems.push(`${f}: contains a template placeholder`);
    const len = v.trim().length;
    const oldLen = String(old[f]).length;
    if (len < 60 || len > 700) problems.push(`${f}: ${len} chars is outside 60-700`);
    if (len > oldLen * 1.8 + 40) problems.push(`${f}: grew from ${oldLen} to ${len} chars; a refresh tightens, it does not pad`);
    if (!/[.!?]$/.test(v.trim())) problems.push(`${f}: does not end as a sentence`);
  }
  if (problems.length) return problems;

  // No figure that is not already on the page. A refresh may restate arithmetic the
  // page already shows; it may not introduce a price, a percentage, a count or a date.
  const known = numbersIn(source);
  for (const f of SENT_FIELDS) for (const n of numbersIn(next[f])) if (!known.has(n)) problems.push(`${f}: introduces the figure "${n}", which the page does not already carry`);

  // No new proper noun: that is how an invented person, brand, reviewer, venue or
  // agency gets in. Capitalised words must already be on the page or be subject
  // acronyms.
  const sourceWords = new Set(words(source));
  for (const f of SENT_FIELDS) {
    for (const t of capitalisedNonInitial(next[f])) {
      if (CAPS_ALLOW.has(t) || sourceWords.has(t.toLowerCase())) continue;
      problems.push(`${f}: introduces the proper noun "${t}"`);
    }
  }

  // No citation, statistic or study language unless the page already used it.
  for (const f of SENT_FIELDS) {
    const m = String(next[f]).match(CLAIM_LANGUAGE);
    if (m && !CLAIM_LANGUAGE.test(before)) problems.push(`${f}: uses claim language "${m[0]}", which needs a source this repo does not hold`);
  }

  // The hedge stays. Every shipping working example is "Example: ..." or an
  // explicitly hedged illustration; that form is what keeps a figure honest.
  if (/^Example:/.test(old.working_example) && !/^Example:/.test(next.working_example.trim())) problems.push('working_example: must keep the "Example:" hedge');

  // A real change, not a reword. Changed words across the three sentences, counted
  // both ways; and the summary and recommendation must each actually change.
  const a = new Set(words(before));
  const b = new Set(words(SENT_FIELDS.map((f) => next[f]).join(' ')));
  let changed = 0;
  for (const w of b) if (!a.has(w)) changed++;
  for (const w of a) if (!b.has(w)) changed++;
  if (changed < 10) problems.push(`only ${changed} words differ; that is a reword, not a refresh`);
  for (const f of ['summary', 'recommendation']) if (next[f].trim() === String(old[f]).trim()) problems.push(`${f}: unchanged`);

  // Still about the same thing: the title's subject words must survive.
  // Title words the old sentences carried must still be carried.
  const was = aboutnessTokens(before);
  const subject = new Set([...aboutnessTokens(old.title)].filter((w) => was.has(w) && !/^\d/.test(w)));
  const kept = aboutnessTokens(next.summary, next.recommendation, next.working_example);
  const lost = [...subject].filter((w) => !kept.has(w));
  if (subject.size && lost.length > Math.floor(subject.size / 2)) problems.push(`drifted off the subject: ${lost.join(', ')} no longer appear`);
  return problems;
}

// Library similarity, the same measure validate_authority_scale.mjs and the publisher apply.
const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const tokenSet = (p) => new Set(norm([p.answer, ...(p.steps || []), ...(p.mistakes || [])].join(' ')).split(' ').filter((x) => x.length > 3));
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = new Set([...a, ...b]).size; return u ? i / u : 0; };
export function maxSimilarity(page, library) {
  const mine = tokenSet(page);
  let max = 0; let pair = null;
  for (const other of library) {
    if (other.slug === page.slug || !isComplete(other)) continue;
    const s = jaccard(mine, tokenSet(other));
    if (s > max) { max = s; pair = other.slug; }
  }
  return { max, pair };
}

/** Related links that no longer resolve to a renderable guide in the same cluster. */
export function brokenLinks(page, library) {
  const bySlug = new Map(library.map((p) => [p.slug, p]));
  return (page.related_slugs || []).filter((s) => { const p = bySlug.get(s); return !p || !isComplete(p) || s === page.slug; });
}

function pickRelated(page, library, keep) {
  const mine = aboutnessTokens(page.title, page.summary, page.steps?.[1]);
  const pool = library.filter((p) => p.cluster === page.cluster && p.slug !== page.slug && isComplete(p) && !keep.includes(p.slug));
  const ranked = pool.map((p) => {
    const theirs = aboutnessTokens(p.title, p.summary, p.steps?.[1]);
    let overlap = 0; for (const w of mine) if (theirs.has(w)) overlap++;
    return { slug: p.slug, overlap };
  }).sort((x, y) => y.overlap - x.overlap || x.slug.localeCompare(y.slug));
  return [...keep, ...ranked.map((r) => r.slug)].slice(0, 4);
}

/**
 * Apply three new sentences to a registry record. Scaffold guides are recomposed
 * from the current spec; bespoke guides have each old sentence replaced wherever it
 * appears, and must have no trace of the old sentence left.
 */
export function applySentences(page, next, spec, library, today) {
  const old = extractSeed(page);
  const broken = brokenLinks(page, library);
  const related = broken.length ? pickRelated(page, library, page.related_slugs.filter((s) => !broken.includes(s))) : [...page.related_slugs];
  const cluster = spec.clusters?.[page.cluster];
  const scaffold = cluster && !(spec.bespoke_slugs || []).includes(page.slug);
  const seed = { slug: page.slug, title: page.title, cluster: page.cluster, updated_at: today, summary: next.summary.trim(), recommendation: next.recommendation.trim(), working_example: next.working_example.trim() };
  if (scaffold) return { record: composeGuide(seed, cluster, related), broken };
  const swap = (v) => {
    if (typeof v === 'string') {
      let s = v;
      for (const f of SENT_FIELDS) s = s.split(old[f]).join(seed[f]);
      return s;
    }
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  const record = { ...swap(page), related_slugs: related, updated_at: today };
  const left = JSON.stringify({ ...record, title: '' });
  for (const f of SENT_FIELDS) if (left.includes(old[f])) throw new Error(`bespoke guide ${page.slug}: old ${f} still present after replacement`);
  return { record, broken };
}

// ---------------------------------------------------------------------------
// The model call.

export function buildMessages(page, target, rules, feedback) {
  const old = extractSeed(page);
  const system = [
    'You refresh an existing wedding planning guide. You rewrite exactly three sentences that carry its judgement, and nothing else.',
    'Rules the library holds every guide to:',
    ...rules.map((r) => `- ${r}`),
    'Refresh rules:',
    '- Keep every claim the current sentences make, unless it is overstated; then soften it. Add nothing that needs a source.',
    '- Answer the target search query directly in the summary.',
    '- The recommendation is ordered actions, in the order they must be done; make it sharper and more concrete using only what the guide already says.',
    '- Use ONLY numbers that already appear in the current sentences or the title. No prices, percentages, counts, dates or durations that are not already there.',
    '- No names of people, companies, venues, agencies, laws, studies, surveys, statistics, experts or reviewers. No links.',
    '- working_example must start with "Example:" and stay self-evident arithmetic or an explicitly hedged illustration.',
    '- Each sentence plain text, one paragraph, no markdown, no longer than about one and a half times the current one.',
    'Reply with JSON only: {"summary": "...", "recommendation": "...", "working_example": "...", "change_note": "one line: what was improved"}',
  ].join('\n');
  const user = JSON.stringify({
    title: old.title,
    cluster: old.cluster,
    target_query: target?.query || old.title.toLowerCase(),
    current: { summary: old.summary, recommendation: old.recommendation, working_example: old.working_example },
    ...(feedback?.length ? { previous_attempt_rejected_because: feedback } : {}),
  });
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

export function parseReply(content) {
  // Free models wrap the object in prose, code fences or a <think> block, and those
  // often carry braces of their own. Try every opening brace, newest first, and take
  // the last object that carries the three sentences. Run 41236802294 rejected 2 of
  // 3 replies when this took the span from the first "{" to the last "}".
  const text = String(content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/g, '');
  const want = (o) => o && typeof o === 'object' && SENT_FIELDS.every((f) => typeof o[f] === 'string');
  for (let start = text.lastIndexOf('{'); start >= 0; start = text.lastIndexOf('{', start - 1)) {
    for (let end = text.indexOf('}', start); end > start; end = text.indexOf('}', end + 1)) {
      try { const o = JSON.parse(text.slice(start, end + 1)); if (want(o)) return o; } catch { /* keep scanning */ }
    }
    if (start === 0) break;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The run.

const readJson = (root, rel, fallback) => {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) return fallback;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};
const writeJson = (root, rel, value) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), JSON.stringify(value, null, 2) + '\n');
};
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const guideSlug = (loc) => (loc.match(/\/guides\/([^/?#]+)$/) || [])[1] || null;

export async function runLane({ root = process.cwd(), fetchImpl = globalThis.fetch, apiKey = process.env.OPENROUTER_API_KEY || '', today = cadenceToday(), budgetMs = Number(process.env.REFRESH_LANE_BUDGET_MS || DEFAULT_BUDGET_MS), log = console.log } = {}) {
  const day = today.toISOString().slice(0, 10);
  const started = Date.now();
  const doc = readJson(root, REGISTRY);
  const spec = readJson(root, SPEC);
  const policy = { refresh_window_days: 91, stale_tolerance_pct: 20, ...readJson(root, POLICY, {}) };
  const rules = readJson(root, 'data/authority/editorial_seeds.json', {}).authoring_rules || [];
  const targets = readJson(root, TARGETS, { targets: [] }).targets || [];
  const ledger = readJson(root, LEDGER, { schema_version: 1, pages: {}, runs: [] });
  ledger.pages ||= {}; ledger.runs ||= [];

  const debt = refreshDebt(sitemapUrls(root), policy, today);
  const library = doc.pages || [];
  const bySlug = new Map(library.map((p, i) => [p.slug, i]));
  const record = (key, entry) => { ledger.pages[key] = { ...(ledger.pages[key] || {}), ...entry, at: day }; };

  // Candidates: oldest first, guides only, not inside a rejection cool-off.
  const candidates = [];
  for (const e of debt.stale_urls) {
    const slug = guideSlug(e.loc);
    const key = slug ? `/guides/${slug}` : new URL(e.loc).pathname;
    if (!slug || !bySlug.has(slug)) {
      if (ledger.pages[key]?.status !== 'NOT_A_REGISTRY_GUIDE') record(key, { status: 'NOT_A_REGISTRY_GUIDE', reason: 'hub or product page; its content is not three authored sentences in the registry, so this lane cannot refresh it honestly. It ages with its hub source file.' });
      continue;
    }
    const prev = ledger.pages[key];
    if (prev?.status === 'REJECTED' && daysBetween(prev.at, day) < COOL_OFF_DAYS) continue;
    candidates.push({ slug, key, loc: e.loc });
  }

  const n = perRun(debt.refreshes_needed, candidates.length);
  const refreshed = [];
  const rejected = [];
  let stop = null;

  if (!debt.stale) stop = { outcome: 'QUEUE_EMPTY', reason: `no page is older than ${policy.refresh_window_days} days` };
  else if (!candidates.length) stop = { outcome: 'NONE_PASSED_GUARDS', reason: `${debt.stale} page(s) are stale but every guide among them is in its ${COOL_OFF_DAYS}-day cool-off after a rejection, or is not a registry guide` };

  for (const c of stop ? [] : candidates) {
    if (refreshed.length >= n) break;
    if (refreshed.length + rejected.length >= n * 3) break;
    if (Date.now() - started > budgetMs) { log(`refresh lane: time budget ${budgetMs}ms spent`); break; }
    const page = library[bySlug.get(c.slug)];
    const old = extractSeed(page);
    const target = targets.find((t) => t.route === c.key);
    let feedback = null;
    let accepted = null;
    let lastProblems = [];
    for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
      const res = await routeChat({ messages: buildMessages(page, target, rules, feedback), purpose: `refresh-lane:${c.slug}`, apiKey, fetchImpl, maxTokens: 2000, temperature: 0.4 });
      if (res.status !== 'OK') { stop = { outcome: 'MODEL_UNAVAILABLE', stop: res.stop, reason: res.reason }; break; }
      const next = parseReply(res.content);
      if (!next) { lastProblems = [`model reply was not the JSON object asked for (${res.model}: ${JSON.stringify(String(res.content).slice(0, 120))})`]; feedback = ['reply with the JSON object only, no other text']; continue; }
      const problems = factGuard({ ...old, title: page.title }, next);
      if (!problems.length) {
        let applied;
        try { applied = applySentences(page, next, spec, library, day); } catch (err) { problems.push(String(err.message || err)); }
        if (applied) {
          const rec = applied.record;
          if (!isComplete(rec)) problems.push('recomposed record is not renderable');
          if (findPlaceholders(rec).length) problems.push('recomposed record carries a placeholder');
          const ceiling = Number(spec.near_duplicate?.observed_max_among_shipping_guides ?? 0.73);
          const before = maxSimilarity(page, library).max;
          const after = maxSimilarity(rec, library);
          if (after.max > Math.max(ceiling, before) + 1e-9) problems.push(`similarity ${after.max.toFixed(3)} to ${after.pair} is above the library ceiling ${ceiling}`);
          if (JSON.stringify({ ...rec, updated_at: '' }) === JSON.stringify({ ...page, updated_at: '' })) problems.push('no content change');
          if (!problems.length) accepted = { rec, broken: applied.broken, model: res.model, note: String(next.change_note || '').slice(0, 240) };
        }
      }
      if (problems.length) { lastProblems = problems; feedback = problems; }
    }
    if (stop) break;
    if (accepted) {
      library[bySlug.get(c.slug)] = accepted.rec;
      refreshed.push({ route: c.key, model: accepted.model, change_note: accepted.note, links_repaired: accepted.broken });
      record(c.key, { status: 'REFRESHED', model: accepted.model, change_note: accepted.note, links_repaired: accepted.broken });
      log(`refreshed ${c.key} (${accepted.model})${accepted.broken.length ? `; repaired links ${accepted.broken.join(', ')}` : ''}`);
    } else {
      rejected.push({ route: c.key, reasons: lastProblems.slice(0, 6) });
      record(c.key, { status: 'REJECTED', reason: lastProblems.slice(0, 6).join(' | '), retry_after_days: COOL_OFF_DAYS });
      log(`not refreshed ${c.key}: ${lastProblems.slice(0, 3).join(' | ')}`);
    }
  }

  if (refreshed.length) {
    doc.pages = library;
    writeJson(root, REGISTRY, doc);
    // Authorise exactly these routes through the content freeze. restore skips them,
    // freeze re-records them, and the workflow clears the scope after the freeze.
    const scope = readJson(root, SCOPE, { routes: [] });
    scope.routes = [...new Set([...(scope.routes || []), ...refreshed.map((r) => r.route)])].sort();
    scope.reason = 'refresh lane: substantive refresh of guides past the refresh window';
    writeJson(root, SCOPE, scope);
  }

  let outcome;
  if (refreshed.length) outcome = { outcome: 'REFRESHED', reason: `${refreshed.length} guide(s) substantively refreshed; ${rejected.length} rejected` };
  else if (stop) outcome = stop;
  else outcome = { outcome: 'NONE_PASSED_GUARDS', reason: `${rejected.length} candidate(s) tried, none passed the fact guards; reasons are in ${LEDGER}` };

  ledger.runs = [...ledger.runs.filter((r) => r.at !== day || r.refreshed > 0 || refreshed.length === 0), { at: day, outcome: outcome.outcome, refreshed: refreshed.length, queued: debt.stale }].slice(-30);
  ledger.updated_at = day;
  writeJson(root, LEDGER, ledger);

  const receipt = {
    at: day,
    ...outcome,
    per_run: n,
    queue_before: debt.stale,
    refreshes_needed_before: debt.refreshes_needed,
    refreshed,
    rejected,
    unblocked_by: outcome.outcome === 'MODEL_UNAVAILABLE' ? 'a $0 model answering on the next run (scripts/llm/free_router.mjs --check --ping)' : outcome.outcome === 'NONE_PASSED_GUARDS' ? `the next run tries the next pages; rejected pages retry after ${COOL_OFF_DAYS} days` : null,
  };
  writeJson(root, OUTCOME, receipt);
  return receipt;
}

/** Stalled: queue non-empty and nothing refreshed on each of the last STALL_RUN_DAYS run days. */
export function stalled(ledger) {
  const byDay = new Map();
  for (const r of ledger?.runs || []) byDay.set(r.at, (byDay.get(r.at) || 0) + (r.refreshed || 0) + (r.queued ? 0 : 1));
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-STALL_RUN_DAYS);
  return days.length >= STALL_RUN_DAYS && days.every(([, v]) => v === 0);
}

function summarise(receipt, ledger, root) {
  const lines = [
    `### Refresh lane: ${receipt.outcome}`,
    '',
    `${receipt.reason}. Queue before this run: ${receipt.queue_before} stale page(s), ${receipt.refreshes_needed_before} needed to lift the publishing hold; ${receipt.per_run} per run.`,
    ...receipt.refreshed.map((r) => `- refreshed ${r.route}: ${r.change_note || '(no note)'}`),
    ...receipt.rejected.map((r) => `- not refreshed ${r.route}: ${r.reasons.join(' | ')}`),
    receipt.unblocked_by ? `\nUnblocked by: ${receipt.unblocked_by}` : '',
  ];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  if (stalled(ledger)) {
    console.error(`REFRESH LANE STALLED: nothing refreshed on the last ${STALL_RUN_DAYS} run days while pages are past the window. See ${OUTCOME} and ${LEDGER} in ${root}.`);
    return 1;
  }
  return 0;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMain) {
  const root = process.cwd();
  if (process.argv.includes('--name-outcome')) {
    const receipt = readJson(root, OUTCOME, null);
    if (!receipt) { console.error(`refresh lane produced no outcome receipt at ${OUTCOME}`); process.exit(1); }
    process.exit(summarise(receipt, readJson(root, LEDGER, {}), root));
  }
  try {
    const receipt = await runLane({ root });
    console.log(`REFRESH LANE ${receipt.outcome}: ${receipt.reason}`);
  } catch (err) {
    if (err instanceof PaidCostError) { console.error(`REFRESH LANE BROKEN: ${err.message}`); process.exit(1); }
    console.error(`REFRESH LANE BROKEN: ${err?.stack || err}`);
    process.exit(1);
  }
}
