#!/usr/bin/env node
// Citation occupancy: ask an answer engine the queries these four properties are
// built for, and record who it actually cites.
//
// Why this exists
// ---------------
// This repo had no citation measurement of any kind. The nearest thing,
// data/queries/evidence/evidence_queries.json, holds 13 rows that are all T2b
// modelled: competitor_ranking_url is "NO_DATA" on all 13, serp_features is []
// on all 13, and weak_incumbent_score is exactly 1 - keyword_difficulty/100 on
// every row - an arithmetic restatement of a bought Semrush number, not an
// observation of anybody's position. Nothing in the repo had ever looked at a
// result surface for these queries.
//
// This does look. It sends the query to an OpenRouter model with the web plugin
// attached and reads message.annotations[].url_citation.url - the pages the
// answer was actually built from. Those hosts are the incumbents in the answer
// layer for that query, measured rather than modelled.
//
// What it does not claim
//   - One engine on one day is not the answer layer. Runs are appended with
//     timestamps so a trend can be read; a single run is not a verdict.
//   - An LLM's web citations are not Google's SERP and must never be reported as
//     rank. Observations carry evidence_class ANSWER_ENGINE_CITATION_SURFACE.
//   - A rate is only written when the provider answered. An error is recorded as
//     an error. A run where nothing answered has no rate at all, because 0% and
//     "not measured" are different facts and the first one is a lie about the
//     second.
//
// Outcomes
//   MEASURED       every query answered                                exit 0
//   DEGRADED       some answered, some errored; both are recorded      exit 0
//   PROVIDER_ERROR nothing answered; no rate is written                exit 1
//   HELD_CADENCE   the last run is inside the minimum interval         exit 0
//   UNCONFIGURED   no OPENROUTER_API_KEY; nothing attempted            exit 0
//
// Usage: node scripts/search_intelligence/llm_citation_probe.mjs [--limit N] [--force] [--dry-run]
import { read, write, now, hostOf } from './lib.mjs';

const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const FORCE = argv.includes('--force');
const DRY = argv.includes('--dry-run');

const OUT = 'data/search_intelligence/citation_occupancy.json';
const cfg = read('data/search_intelligence/config.json');
const probeCfg = cfg.providers?.answer_engine_citation || {};
const MODEL = process.env.OPENROUTER_MODEL || probeCfg.model || 'openai/gpt-4o-mini';
const MAX_RESULTS = Number(process.env.CITATION_MAX_RESULTS || probeCfg.max_results_per_query || 5);
const MIN_HOURS = Number(process.env.CITATION_MIN_HOURS || probeCfg.min_hours_between_runs || 168);
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 45000);
const LIMIT = Number(arg('--limit', String(probeCfg.queries_per_run || 13)));

const ownership = read('data/seo/route_ownership.json');
const OWNED = Object.keys(ownership.hosts || {}).map((h) => h.toLowerCase().replace(/^www\./, ''));

// Queries come from the evidence file, unchanged. Nothing here invents a query,
// a volume or a difficulty; the probe only observes what an answer engine
// returns for phrasings the repo already holds evidence for.
const evidence = read('data/queries/evidence/evidence_queries.json');
const queries = (evidence.queries || [])
  .filter((q) => q.query && q.target_domain)
  .map((q) => ({ query: q.query, property: q.target_domain, evidence_tier: q.evidence_tier }))
  .slice(0, LIMIT);

const prior = read(OUT, { schema_version: '1.0.0', note: 'Answer-engine citation occupancy. Appended per run. A rate exists only where a provider answered.', runs: [] });
const runAt = now();

function finish(run, code) {
  prior.runs = [...(prior.runs || []).slice(-49), run];
  prior.updated_at = runAt;
  prior.latest = { run_at: run.run_at, state: run.state, ...(run.summary || {}) };
  write(OUT, prior);
  console.log(`CITATION OCCUPANCY: ${run.state}${run.reason ? ` - ${run.reason}` : ''}`);
  process.exit(code);
}

const key = process.env.OPENROUTER_API_KEY || '';
if (!queries.length) finish({ run_at: runAt, state: 'UNCONFIGURED', reason: 'no evidence-backed queries to probe', provider: 'openrouter', model: MODEL, observations: [], summary: { self_cited_rate_pct: null } }, 0);
if (!key || DRY) {
  finish({
    run_at: runAt, state: 'UNCONFIGURED', provider: 'openrouter', model: MODEL,
    reason: DRY ? 'dry run: nothing was asked' : 'OPENROUTER_API_KEY absent; nothing was asked and no occupancy is claimed',
    queries_ready: queries.length, owned_hosts: OWNED, observations: [], summary: { self_cited_rate_pct: null },
  }, 0);
}

const last = [...(prior.runs || [])].reverse().find((r) => r.state === 'MEASURED' || r.state === 'DEGRADED');
if (last && !FORCE) {
  const hours = (Date.now() - new Date(last.run_at).getTime()) / 3600000;
  if (hours < MIN_HOURS) {
    finish({
      run_at: runAt, state: 'HELD_CADENCE', provider: 'openrouter', model: MODEL,
      reason: `last measured run was ${hours.toFixed(1)}h ago; this probe bills per web result and runs at most every ${MIN_HOURS}h. Use --force to override.`,
      observations: [], summary: { self_cited_rate_pct: null },
    }, 0);
  }
}

async function ask(query) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        plugins: [{ id: 'web', max_results: MAX_RESULTS }],
        temperature: 0,
        max_tokens: 500,
        messages: [{ role: 'user', content: query }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    const message = data?.choices?.[0]?.message || {};
    const urls = [];
    for (const a of message.annotations || []) if (a?.url_citation?.url) urls.push(a.url_citation.url);
    // No annotations means the plugin returned nothing to cite. That is an
    // answer without retrieval, not an observation of occupancy, so it is
    // recorded as an error rather than as an empty result surface.
    if (!urls.length) return { ok: false, error: 'provider answered with no url_citation annotations; nothing was retrieved to observe' };
    return { ok: true, urls: [...new Set(urls)], answer: message.content || '' };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  } finally { clearTimeout(t); }
}

const observations = [];
for (const q of queries) {
  const r = await ask(q.query);
  if (!r.ok) {
    observations.push({ query: q.query, property: q.property, evidence_tier: q.evidence_tier, engine: `openrouter:${MODEL}`, observed_at: now(), status: 'provider_error', error: r.error });
    console.log(`  ERROR   ${q.query} :: ${String(r.error).slice(0, 80)}`);
    continue;
  }
  const domains = [...new Set(r.urls.map(hostOf).filter(Boolean))];
  const ours = domains.filter((d) => OWNED.some((o) => d === o || d.endsWith(`.${o}`)));
  observations.push({
    query: q.query, property: q.property, evidence_tier: q.evidence_tier,
    engine: `openrouter:${MODEL}`, observed_at: now(),
    status: 'observed',
    evidence_class: 'ANSWER_ENGINE_CITATION_SURFACE',
    note: 'answer-engine citations for this query on this date; not universal rank and not equivalent to a SERP position',
    citations: r.urls, cited_domains: domains, cited_ours: ours, self_cited: ours.length > 0,
  });
  console.log(`  ${ours.length ? 'CITED  ' : '  --   '} ${q.query} :: ${domains.slice(0, 4).join(', ')}${domains.length > 4 ? ` +${domains.length - 4}` : ''}`);
}

const observed = observations.filter((o) => o.status === 'observed');
const errored = observations.filter((o) => o.status === 'provider_error');

// Occupancy: who holds the answer layer for these queries. Counted only over
// queries that were actually answered.
const occupancy = {};
for (const o of observed) for (const d of o.cited_domains) occupancy[d] = (occupancy[d] || 0) + 1;
const incumbents = Object.entries(occupancy).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([domain, queries_cited_on]) => ({ domain, queries_cited_on, share_of_answered_pct: Number(((100 * queries_cited_on) / observed.length).toFixed(1)) }));

const byProperty = {};
for (const o of observed) {
  const p = (byProperty[o.property] ||= { queries_answered: 0, queries_self_cited: 0 });
  p.queries_answered += 1;
  if (o.self_cited) p.queries_self_cited += 1;
}
for (const p of Object.values(byProperty)) p.self_cited_rate_pct = Number(((100 * p.queries_self_cited) / p.queries_answered).toFixed(1));

const state = !observed.length ? 'PROVIDER_ERROR' : errored.length ? 'DEGRADED' : 'MEASURED';
const summary = observed.length ? {
  queries_attempted: observations.length,
  queries_answered: observed.length,
  queries_errored: errored.length,
  queries_self_cited: observed.filter((o) => o.self_cited).length,
  self_cited_rate_pct: Number(((100 * observed.filter((o) => o.self_cited).length) / observed.length).toFixed(1)),
  distinct_domains_cited: incumbents.length,
} : {
  queries_attempted: observations.length,
  queries_answered: 0,
  queries_errored: errored.length,
  // Deliberately null, not 0. Nothing answered, so nothing is known about
  // occupancy; a 0% here would be a measurement that was never taken.
  self_cited_rate_pct: null,
};

finish({
  run_at: runAt, state, provider: 'openrouter', model: MODEL, web_max_results: MAX_RESULTS,
  reason: state === 'PROVIDER_ERROR' ? `all ${observations.length} query probe(s) failed; no occupancy rate is recorded` : state === 'DEGRADED' ? `${errored.length} of ${observations.length} queries errored; rates cover the ${observed.length} that answered` : undefined,
  owned_hosts: OWNED, observations, incumbents, by_property: byProperty, summary,
}, state === 'PROVIDER_ERROR' ? 1 : 0);
